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
  TokenUsage,
} from "../types.js";
import { joinUrl, normalizeBaseUrl, withTimeout } from "../utils.js";

interface OllamaModelDetails {
  family?: string;
  parameter_size?: string;
  quantization_level?: string;
  [key: string]: unknown;
}

interface OllamaTagModel {
  name?: string;
  model?: string;
  details?: OllamaModelDetails;
  [key: string]: unknown;
}

interface OllamaTagsResponse {
  models?: OllamaTagModel[];
}

interface OllamaRunningModel {
  name?: string;
  model?: string;
  context_length?: number;
  details?: OllamaModelDetails;
  [key: string]: unknown;
}

interface OllamaPsResponse {
  models?: OllamaRunningModel[];
}

interface OllamaChatResponse {
  model?: string;
  message?: {
    role?: string;
    content?: string;
  };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  [key: string]: unknown;
}

export function createOllamaNativeAdapter(): ProviderAdapter {
  return {
    id: "ollama",
    name: "Ollama",
    defaultBaseUrls: ["http://localhost:11434"],
    capabilities: ["chat", "chat-streaming", "model-list"],

    async detect(options) {
      const provider = { ...options.provider, status: "unavailable" as const };

      try {
        await requestJson<unknown>(options, joinUrl(options.provider.baseUrl, "/api/version"), {
          method: "GET",
          headers: { Accept: "application/json" },
        });

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

    listModels: listOllamaModels,
    chat: chatWithOllama,
    streamChat: streamChatWithOllama,
  };
}

async function listOllamaModels(options: AdapterRequestOptions): Promise<LocalRelayModel[]> {
  const tagsEndpoint = joinUrl(options.provider.baseUrl, "/api/tags");
  const psEndpoint = joinUrl(options.provider.baseUrl, "/api/ps");

  const tags = await requestJson<OllamaTagsResponse>(options, tagsEndpoint, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!Array.isArray(tags.models)) {
    throw new InvalidProviderResponseError("Ollama did not return a model list.", {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint: tagsEndpoint,
    });
  }

  let runningModels = new Map<string, OllamaRunningModel>();

  try {
    const ps = await requestJson<OllamaPsResponse>(options, psEndpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (Array.isArray(ps.models)) {
      runningModels = new Map(
        ps.models
          .map((model) => [model.model ?? model.name, model] as const)
          .filter((entry): entry is readonly [string, OllamaRunningModel] => typeof entry[0] === "string"),
      );
    }
  } catch {
    runningModels = new Map();
  }

  return tags.models
    .filter((model) => typeof (model.model ?? model.name) === "string")
    .map((model) => {
      const id = (model.model ?? model.name) as string;
      const running = runningModels.get(id);
      const details = model.details ?? running?.details;

      return {
        id,
        name: model.name ?? id,
        provider: options.provider.id,
        ...(details?.family !== undefined ? { family: details.family } : {}),
        ...(details?.parameter_size !== undefined ? { parameterSize: details.parameter_size } : {}),
        ...(details?.quantization_level !== undefined ? { quantization: details.quantization_level } : {}),
        ...(running?.context_length !== undefined ? { contextLength: running.context_length } : {}),
        loaded: running !== undefined,
        raw: {
          tags: model,
          running,
        },
      };
    });
}

async function chatWithOllama(options: AdapterChatRequest): Promise<ChatResponse> {
  const endpoint = joinUrl(options.provider.baseUrl, "/api/chat");
  const response = await requestJson<OllamaChatResponse>(options, endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(createOllamaChatBody(options.request, false)),
  });

  const content = response.message?.content;
  if (typeof content !== "string") {
    throw new InvalidProviderResponseError("Ollama did not return a chat message.", {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
    });
  }

  const usage = normalizeUsage(response);

  return {
    model: response.model ?? options.request.model,
    provider: options.provider.id,
    content,
    ...(usage !== undefined ? { usage } : {}),
    raw: response,
  };
}

async function* streamChatWithOllama(
  options: AdapterChatRequest,
): AsyncIterable<ChatStreamEvent> {
  const endpoint = joinUrl(options.provider.baseUrl, "/api/chat");

  yield { type: "start", provider: options.provider.id, model: options.request.model };

  const response = await withTimeout(
    (signal) =>
      options.fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createOllamaChatBody(options.request, true)),
        signal,
      }),
    options.timeoutMs,
    options.signal,
    {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
    },
  ).catch((error) => {
    if (error instanceof TypeError) {
      throw new ProviderCorsError("Ollama request failed. This may be a CORS or network issue.", {
        provider: options.provider.id,
        baseUrl: options.provider.baseUrl,
        endpoint,
        cause: error,
        suggestion: "Try using the future Local Relay proxy or configure Ollama CORS settings.",
      });
    }

    throw error;
  });

  if (!response.ok) {
    throw new ProviderUnavailableError(`Ollama returned HTTP ${response.status}.`, {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
      status: response.status,
    });
  }

  if (!response.body) {
    throw new InvalidProviderResponseError("Ollama did not return a streaming body.", {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
    });
  }

  let fullContent = "";

  for await (const payload of parseNewlineDelimitedJson(response.body)) {
    const event = parseJsonPayload<OllamaChatResponse>(payload, {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
    });

    const token = event.message?.content;
    if (typeof token === "string" && token.length > 0) {
      fullContent += token;
      yield { type: "token", text: token, raw: event };
    }

    if (event.done) {
      const usage = normalizeUsage(event);
      if (usage) {
        yield { type: "usage", usage, raw: event };
      }
      break;
    }
  }

  yield { type: "message", content: fullContent };
  yield { type: "done" };
}

function createOllamaChatBody(
  request: { model: string; messages: ChatMessage[]; temperature?: number; maxTokens?: number },
  stream: boolean,
): Record<string, unknown> {
  return {
    model: request.model,
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.name ? { name: message.name } : {}),
    })),
    stream,
    ...(request.temperature !== undefined || request.maxTokens !== undefined
      ? {
          options: {
            ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
            ...(request.maxTokens !== undefined ? { num_predict: request.maxTokens } : {}),
          },
        }
      : {}),
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
      throw new ProviderCorsError("Ollama request failed. This may be a CORS or network issue.", {
        provider: options.provider.id,
        baseUrl: options.provider.baseUrl,
        endpoint,
        cause: error,
        suggestion: "Try using the future Local Relay proxy or configure Ollama CORS settings.",
      });
    }

    throw error;
  });

  if (!response.ok) {
    throw new ProviderUnavailableError(`Ollama returned HTTP ${response.status}.`, {
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

async function* parseNewlineDelimitedJson(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
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
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 0) {
          yield trimmed;
        }
      }
    }

    const remaining = buffer.trim();
    if (remaining.length > 0) {
      yield remaining;
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
    throw new InvalidProviderResponseError("Ollama returned invalid JSON.", {
      ...details,
      cause: error,
    });
  }
}

function normalizeUsage(response: OllamaChatResponse): TokenUsage | undefined {
  if (response.prompt_eval_count === undefined && response.eval_count === undefined) {
    return undefined;
  }

  const promptTokens = response.prompt_eval_count;
  const completionTokens = response.eval_count;

  return {
    ...(promptTokens !== undefined ? { promptTokens } : {}),
    ...(completionTokens !== undefined ? { completionTokens } : {}),
    ...(promptTokens !== undefined && completionTokens !== undefined
      ? { totalTokens: promptTokens + completionTokens }
      : {}),
    raw: response,
  };
}
