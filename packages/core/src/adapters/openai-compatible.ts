import {
  InvalidProviderResponseError,
  ProviderCorsError,
  ProviderUnavailableError,
} from "../errors.js";
import type {
  AdapterChatRequest,
  AdapterEmbeddingRequest,
  AdapterRequestOptions,
  AdapterResponseRequest,
  ChatMessage,
  ChatResponse,
  ChatStreamEvent,
  ChatToolCall,
  EmbeddingResponse,
  LocalRelayResponse,
  LocalRelayModel,
  ProviderAdapter,
  ProviderCapability,
  ProviderId,
  ResponseStreamEvent,
  ResponseOutputItem,
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
      tool_calls?: OpenAIChatToolCall[];
    };
    delta?: {
      content?: string | null;
      tool_calls?: OpenAIChatToolCall[];
    };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface OpenAIChatToolCall {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
  [key: string]: unknown;
}

interface OpenAIEmbeddingsResponse {
  model?: string;
  data?: Array<{
    index?: number;
    object?: string;
    embedding?: number[] | string;
    [key: string]: unknown;
  }>;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface OpenAIResponseObject {
  id?: string;
  model?: string;
  output?: unknown[];
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
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
  const capabilities = options.capabilities ?? [
    "chat",
    "chat-streaming",
    "model-list",
    "embeddings",
    "responses-api",
    "tools",
    "vision",
    "json-mode",
  ];

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
    embeddings: embeddingsWithProvider,
    createResponse: createResponseWithProvider,
    streamResponse: streamResponseWithProvider,
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
  const toolCalls = normalizeToolCalls(response.choices?.[0]?.message?.tool_calls);

  if (typeof content !== "string" && (!toolCalls || toolCalls.length === 0)) {
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
    content: content ?? "",
    ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
    ...(response.choices?.[0]?.finish_reason ? { finishReason: response.choices[0].finish_reason } : {}),
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
    const toolCalls = normalizeToolCalls(event.choices?.[0]?.delta?.tool_calls);

    if (typeof token === "string" && token.length > 0) {
      fullContent += token;
      yield { type: "token", text: token, raw: event };
    }

    for (const toolCall of toolCalls ?? []) {
      yield { type: "tool-call", toolCall, raw: event };
    }

    const usage = normalizeUsage(event.usage);
    if (usage) {
      yield { type: "usage", usage, raw: event };
    }
  }

  yield { type: "message", content: fullContent };
  yield { type: "done" };
}

async function embeddingsWithProvider(options: AdapterEmbeddingRequest): Promise<EmbeddingResponse> {
  const endpoint = joinUrl(options.provider.baseUrl, "/embeddings");
  const body = {
    ...(options.request.rawOptions ?? {}),
    model: options.request.model,
    input: options.request.input,
    ...(options.request.dimensions !== undefined ? { dimensions: options.request.dimensions } : {}),
    ...(options.request.encodingFormat !== undefined ? { encoding_format: options.request.encodingFormat } : {}),
  };

  const response = await requestJson<OpenAIEmbeddingsResponse>(options, endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!Array.isArray(response.data)) {
    throw new InvalidProviderResponseError("Provider did not return an embeddings list.", {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
    });
  }

  const data = response.data.map((item, index) => {
    if (!Array.isArray(item.embedding) && typeof item.embedding !== "string") {
      throw new InvalidProviderResponseError("Provider returned an invalid embedding.", {
        provider: options.provider.id,
        baseUrl: options.provider.baseUrl,
        endpoint,
      });
    }

    return {
      index: item.index ?? index,
      embedding: item.embedding,
      ...(item.object !== undefined ? { object: item.object } : {}),
      raw: item,
    };
  });

  return {
    model: response.model ?? options.request.model,
    provider: options.provider.id,
    data,
    ...(response.usage ? { usage: normalizeOpenAIUsage(response.usage) } : {}),
    raw: response,
  };
}

async function createResponseWithProvider(options: AdapterResponseRequest): Promise<LocalRelayResponse> {
  const endpoint = joinUrl(options.provider.baseUrl, "/responses");
  const body = createOpenAIResponsesBody(options.request, false);
  const response = await requestJson<OpenAIResponseObject>(options, endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return normalizeResponseObject(response, options.provider.id, options.request.model);
}

async function* streamResponseWithProvider(
  options: AdapterResponseRequest,
): AsyncIterable<ResponseStreamEvent> {
  const endpoint = joinUrl(options.provider.baseUrl, "/responses");
  const body = createOpenAIResponsesBody(options.request, true);

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

  if (!response.body) {
    throw new InvalidProviderResponseError("Provider did not return a response stream.", {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
    });
  }

  for await (const payload of parseServerSentEvents(response.body)) {
    if (payload === "[DONE]") {
      break;
    }

    const event = parseJsonPayload<Record<string, unknown>>(payload, {
      provider: options.provider.id,
      baseUrl: options.provider.baseUrl,
      endpoint,
    });
    const eventType = typeof event.type === "string" ? event.type : "response.event";

    if (eventType === "response.output_text.delta" && typeof event.delta === "string") {
      yield { type: "text-delta", text: event.delta, raw: event };
    }

    yield { type: "response-event", event: eventType, raw: event };
  }

  yield { type: "done" };
}

function createOpenAIChatBody(
  request: {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    maxTokens?: number;
    tools?: unknown[];
    toolChoice?: unknown;
    responseFormat?: unknown;
    rawOptions?: Record<string, unknown>;
  },
  stream: boolean,
): Record<string, unknown> {
  return {
    ...(request.rawOptions ?? {}),
    model: request.model,
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
      ...(message.name ? { name: message.name } : {}),
      ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
      ...(message.toolCalls ? { tool_calls: message.toolCalls.map(denormalizeToolCall) } : {}),
    })),
    stream,
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.maxTokens !== undefined ? { max_tokens: request.maxTokens } : {}),
    ...(request.tools !== undefined ? { tools: request.tools } : {}),
    ...(request.toolChoice !== undefined ? { tool_choice: request.toolChoice } : {}),
    ...(request.responseFormat !== undefined ? { response_format: request.responseFormat } : {}),
  };
}

function createOpenAIResponsesBody(
  request: {
    model: string;
    input: unknown;
    instructions?: string;
    previousResponseId?: string;
    temperature?: number;
    maxOutputTokens?: number;
    tools?: unknown[];
    toolChoice?: unknown;
    rawOptions?: Record<string, unknown>;
  },
  stream: boolean,
): Record<string, unknown> {
  return {
    ...(request.rawOptions ?? {}),
    model: request.model,
    input: request.input,
    stream,
    ...(request.instructions !== undefined ? { instructions: request.instructions } : {}),
    ...(request.previousResponseId !== undefined ? { previous_response_id: request.previousResponseId } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.maxOutputTokens !== undefined ? { max_output_tokens: request.maxOutputTokens } : {}),
    ...(request.tools !== undefined ? { tools: request.tools } : {}),
    ...(request.toolChoice !== undefined ? { tool_choice: request.toolChoice } : {}),
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

function normalizeOpenAIUsage(usage: {
  prompt_tokens?: number;
  completion_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  [key: string]: unknown;
}): TokenUsage {
  const promptTokens = usage.prompt_tokens ?? usage.input_tokens;
  const completionTokens = usage.completion_tokens ?? usage.output_tokens;

  return {
    ...(promptTokens !== undefined ? { promptTokens } : {}),
    ...(completionTokens !== undefined ? { completionTokens } : {}),
    ...(usage.total_tokens !== undefined ? { totalTokens: usage.total_tokens } : {}),
    raw: usage,
  };
}

function normalizeToolCalls(toolCalls: OpenAIChatToolCall[] | undefined): ChatToolCall[] | undefined {
  if (!Array.isArray(toolCalls)) {
    return undefined;
  }

  return toolCalls
    .filter((toolCall) => typeof toolCall.id === "string" || typeof toolCall.function?.name === "string")
    .map((toolCall, index) => ({
      id: toolCall.id ?? `tool-call-${index}`,
      type: toolCall.type ?? "function",
      ...(toolCall.function?.name
        ? {
            function: {
              name: toolCall.function.name,
              arguments: toolCall.function.arguments ?? "",
            },
          }
        : {}),
      raw: toolCall,
    }));
}

function denormalizeToolCall(toolCall: ChatToolCall): Record<string, unknown> {
  return {
    id: toolCall.id,
    type: toolCall.type,
    ...(toolCall.function ? { function: toolCall.function } : {}),
  };
}

function normalizeResponseObject(
  response: OpenAIResponseObject,
  provider: ProviderId,
  fallbackModel: string,
): LocalRelayResponse {
  const output = Array.isArray(response.output) ? response.output.map(normalizeResponseOutputItem) : [];
  return {
    ...(response.id !== undefined ? { id: response.id } : {}),
    model: response.model ?? fallbackModel,
    provider,
    output,
    ...(typeof response.output_text === "string" ? { outputText: response.output_text } : {}),
    ...(response.usage ? { usage: normalizeOpenAIUsage(response.usage) } : {}),
    raw: response,
  };
}

function normalizeResponseOutputItem(item: unknown): ResponseOutputItem {
  if (typeof item !== "object" || item === null) {
    return {
      type: "unknown",
      raw: item,
    };
  }

  const record = item as Record<string, unknown>;
  return {
    ...(typeof record.id === "string" ? { id: record.id } : {}),
    type: typeof record.type === "string" ? record.type : "unknown",
    ...(typeof record.role === "string" ? { role: record.role } : {}),
    ...("content" in record ? { content: record.content } : {}),
    ...(typeof record.name === "string" ? { name: record.name } : {}),
    ...(typeof record.arguments === "string" ? { arguments: record.arguments } : {}),
    ...(typeof record.call_id === "string" ? { callId: record.call_id } : {}),
    raw: item,
  };
}
