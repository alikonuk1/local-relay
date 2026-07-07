import {
  InvalidProviderResponseError,
  ProviderCorsError,
  ProviderUnavailableError,
} from "../errors.js";
import type {
  AdapterChatRequest,
  AdapterRequestOptions,
  ChatMessage,
  ChatResponse,
  ChatStreamEvent,
  LocalRelayModel,
  ProviderAdapter,
  ProviderCapability,
  ProviderId,
  TokenUsage,
} from "../types.js";
import { joinUrl, normalizeBaseUrl, withTimeout } from "../utils.js";

interface OpenAIModelListResponse {
  data?: Array<{
    id?: string;
    object?: string;
    owned_by?: string;
    [key: string]: unknown;
  }>;
}

interface OpenAIChatResponse {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    delta?: {
      content?: string | null;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface OpenAICompatibleAdapterOptions {
  id: ProviderId;
  name: string;
  defaultBaseUrls: string[];
  capabilities?: ProviderCapability[];
}

export function createOpenAICompatibleAdapter(
  options: OpenAICompatibleAdapterOptions,
): ProviderAdapter {
  const capabilities = options.capabilities ?? ["chat", "chat-streaming", "model-list"];

  return {
    id: options.id,
    name: options.name,
    defaultBaseUrls: options.defaultBaseUrls.map(normalizeBaseUrl),
    capabilities,

    async detect(requestOptions) {
      const provider = {
        ...requestOptions.provider,
        status: "unavailable" as const,
      };

      try {
        await listModelsForProvider(requestOptions);
        return {
          provider: {
            ...provider,
            status: "available",
          },
        };
      } catch (error) {
        return {
          provider,
          error: error instanceof Error ? error : new Error(String(error)),
        };
      }
    },

    listModels: listModelsForProvider,
    chat: chatWithProvider,
    streamChat: streamChatWithProvider,
  };
}

async function listModelsForProvider(
  options: AdapterRequestOptions,
): Promise<LocalRelayModel[]> {
  const endpoint = joinUrl(options.provider.baseUrl, "/models");

  const response = await requestJson<OpenAIModelListResponse>(
    options,
    endpoint,
    {
      method: "GET",
      headers: { Accept: "application/json" },
    },
  );

  if (!Array.isArray(response.data)) {
    throw new InvalidProviderResponseError("Provider did not return an OpenAI-compatible model list.", {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
    });
  }

  return response.data
    .filter((model) => typeof model.id === "string" && model.id.length > 0)
    .map((model) => ({
      id: model.id as string,
      name: model.id as string,
      provider: options.provider.id,
      raw: model,
    }));
}

async function chatWithProvider(options: AdapterChatRequest): Promise<ChatResponse> {
  const endpoint = joinUrl(options.provider.baseUrl, "/chat/completions");
  const body = createOpenAIChatBody(options.request, false);

  const response = await requestJson<OpenAIChatResponse>(
    options,
    endpoint,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  const content = response.choices?.[0]?.message?.content;

  if (typeof content !== "string") {
    throw new InvalidProviderResponseError("Provider did not return a chat message.", {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
    });
  }

  const usage = normalizeUsage(response.usage);

  return {
    ...(response.id !== undefined ? { id: response.id } : {}),
    model: response.model ?? options.request.model,
    provider: options.provider.id,
    content,
    ...(usage !== undefined ? { usage } : {}),
    raw: response,
  };
}

async function* streamChatWithProvider(
  options: AdapterChatRequest,
): AsyncIterable<ChatStreamEvent> {
  const endpoint = joinUrl(options.provider.baseUrl, "/chat/completions");
  const body = createOpenAIChatBody(options.request, true);

  yield { type: "start", provider: options.provider.id, model: options.request.model };

  const response = await withTimeout(
    (signal) =>
      options.fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      }),
    options.timeoutMs,
    options.signal,
    {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
    },
  );

  if (!response.ok) {
    throw new ProviderUnavailableError(`Provider returned HTTP ${response.status}.`, {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
      status: response.status,
    });
  }

  if (!response.body) {
    throw new InvalidProviderResponseError("Provider did not return a streaming body.", {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
    });
  }

  let fullContent = "";

  for await (const payload of parseServerSentEvents(response.body)) {
    if (payload === "[DONE]") {
      break;
    }

    const event = parseJsonPayload<OpenAIChatResponse>(payload, {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
    });
    const token = event.choices?.[0]?.delta?.content;

    if (typeof token === "string" && token.length > 0) {
      fullContent += token;
      yield { type: "token", text: token, raw: event };
    }

    const usage = normalizeUsage(event.usage);
    if (usage) {
      yield { type: "usage", usage, raw: event };
    }
  }

  yield { type: "message", content: fullContent };
  yield { type: "done" };
}

function createOpenAIChatBody(
  request: { model: string; messages: ChatMessage[]; temperature?: number; maxTokens?: number },
  stream: boolean,
): Record<string, unknown> {
  return {
    model: request.model,
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.name ? { name: message.name } : {}),
      ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
    })),
    stream,
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
  };
}

async function requestJson<T>(
  options: AdapterRequestOptions,
  endpoint: string,
  init: RequestInit,
): Promise<T> {
  const response = await withTimeout(
    (signal) => options.fetch(endpoint, { ...init, signal }),
    options.timeoutMs,
    options.signal,
    {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
    },
  ).catch((error) => {
    if (error instanceof TypeError) {
      throw new ProviderCorsError("Provider request failed. This may be a CORS or network issue.", {
        provider: options.provider.id,
        baseUrl: options.provider.baseUrl,
        endpoint,
        cause: error,
        suggestion: "Try using a local proxy or enabling CORS for the local provider.",
      });
    }

    throw error;
  });

  if (!response.ok) {
    throw new ProviderUnavailableError(`Provider returned HTTP ${response.status}.`, {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
      status: response.status,
    });
  }

  return parseJsonPayload<T>(await response.text(), {
    provider: options.provider.id,
    baseUrl: options.provider.baseUrl,
    endpoint,
  });
}

async function* parseServerSentEvents(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        for (const line of chunk.split("\n")) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data:")) {
            yield trimmed.slice("data:".length).trim();
          }
        }
      }
    }

    if (buffer.length > 0) {
      for (const line of buffer.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data:")) {
          yield trimmed.slice("data:".length).trim();
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseJsonPayload<T>(
  payload: string,
  details: { provider: string; baseUrl: string; endpoint: string },
): T {
  try {
    return JSON.parse(payload) as T;
  } catch (error) {
    throw new InvalidProviderResponseError("Provider returned invalid JSON.", {
      ...details,
      cause: error,
    });
  }
}

function normalizeUsage(usage: OpenAIChatResponse["usage"]): TokenUsage | undefined {
  if (!usage) {
    return undefined;
  }

  return {
    ...(usage.prompt_tokens !== undefined ? { promptTokens: usage.prompt_tokens } : {}),
    ...(usage.completion_tokens !== undefined ? { completionTokens: usage.completion_tokens } : {}),
    ...(usage.total_tokens !== undefined ? { totalTokens: usage.total_tokens } : {}),
    raw: usage,
  };
}
