import { LocalRelayError, ProviderUnavailableError } from "./errors.js";
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
  ChatStreamRequest,
  CreateLocalRelayProxyClientOptions,
  EmbeddingRequest,
  EmbeddingResponse,
  LocalRelayResponse,
  LocalRelayClient,
  LocalRelayModel,
  ProviderDetectionResult,
  ProviderId,
  ProviderRequestOptions,
  ResponseRequest,
  ResponseStreamEvent,
  ResponseStreamRequest,
} from "./types.js";
import { joinUrl, normalizeBaseUrl } from "./utils.js";

const DEFAULT_PROXY_BASE_URL = "http://127.0.0.1:44114";
const DEFAULT_PROXY_TIMEOUT_MS = 5000;
const DEFAULT_PROXY_REQUEST_TIMEOUT_MS = 60000;

export function createLocalRelayProxyClient(
  options: CreateLocalRelayProxyClientOptions = {},
): LocalRelayClient {
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    throw new Error("Local Relay proxy client requires a fetch implementation.");
  }

  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_PROXY_BASE_URL);
  const timeoutMs = options.timeoutMs ?? DEFAULT_PROXY_TIMEOUT_MS;
  const requestTimeoutMs = options.requestTimeoutMs ?? options.timeoutMs ?? DEFAULT_PROXY_REQUEST_TIMEOUT_MS;

  return {
    async detectProviders(detectOptions = {}) {
      const response = await requestJson<{ providers: ProviderDetectionResult[] }>(
        fetchImpl,
        joinUrl(baseUrl, "/providers"),
        {
          method: "GET",
          timeoutMs: detectOptions.timeoutMs ?? timeoutMs,
          ...(detectOptions.signal ? { signal: detectOptions.signal } : {}),
        },
      );

      return response.providers;
    },

    async listModels(requestOptions = {}) {
      if (requestOptions.provider || requestOptions.baseUrl) {
        return listModelsForProvider(fetchImpl, baseUrl, requestOptions, timeoutMs);
      }

      const detection = await this.detectProviders({
        timeoutMs: requestOptions.timeoutMs ?? timeoutMs,
        ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
      });
      const available = detection.filter((item) => item.provider.status === "available");
      const models = await Promise.all(
        available.map((item) =>
          listModelsForProvider(
            fetchImpl,
            baseUrl,
            {
              provider: item.provider.id,
              ...(requestOptions.timeoutMs !== undefined ? { timeoutMs: requestOptions.timeoutMs } : {}),
              ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
            },
            timeoutMs,
          ).catch(() => [] satisfies LocalRelayModel[]),
        ),
      );

      return models.flat();
    },

    chat(request) {
      const provider = resolveProxyProvider(request);
      return requestJson<{ response: ChatResponse }>(
        fetchImpl,
        joinUrl(baseUrl, `/providers/${encodeURIComponent(provider)}/chat`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createProxyChatBody(request)),
          timeoutMs: request.timeoutMs ?? requestTimeoutMs,
          ...(request.signal ? { signal: request.signal } : {}),
        },
      ).then((payload) => payload.response);
    },

    async *streamChat(request: ChatStreamRequest) {
      const provider = resolveProxyProvider(request);
      const response = await requestFetch(
        fetchImpl,
        joinUrl(baseUrl, `/providers/${encodeURIComponent(provider)}/chat/stream`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createProxyChatBody(request)),
          timeoutMs: request.timeoutMs ?? requestTimeoutMs,
          ...(request.signal ? { signal: request.signal } : {}),
        },
      );

      if (!response.ok) {
        throw await createProxyError(response);
      }

      if (!response.body) {
        throw new LocalRelayError("Local Relay proxy did not return a streaming body.", {
          code: "proxy_invalid_response",
          endpoint: response.url,
        });
      }

      for await (const payload of parseServerSentEvents(response.body)) {
        const event = parseProxyPayload<ChatStreamEvent>(payload, response.url);
        if (event.type === "error") {
          yield {
            type: "error",
            error: deserializeProxyError(event.error),
          };
          continue;
        }

        yield event;
      }
    },

    embeddings(request) {
      const provider = resolveProxyProvider(request);
      return requestJson<{ response: EmbeddingResponse }>(
        fetchImpl,
        joinUrl(baseUrl, `/providers/${encodeURIComponent(provider)}/embeddings`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createProxyEmbeddingBody(request)),
          timeoutMs: request.timeoutMs ?? requestTimeoutMs,
          ...(request.signal ? { signal: request.signal } : {}),
        },
      ).then((payload) => payload.response);
    },

    createResponse(request) {
      const provider = resolveProxyProvider(request);
      return requestJson<{ response: LocalRelayResponse }>(
        fetchImpl,
        joinUrl(baseUrl, `/providers/${encodeURIComponent(provider)}/responses`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createProxyResponseBody(request)),
          timeoutMs: request.timeoutMs ?? requestTimeoutMs,
          ...(request.signal ? { signal: request.signal } : {}),
        },
      ).then((payload) => payload.response);
    },

    async *streamResponse(request: ResponseStreamRequest) {
      const provider = resolveProxyProvider(request);
      const response = await requestFetch(
        fetchImpl,
        joinUrl(baseUrl, `/providers/${encodeURIComponent(provider)}/responses/stream`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createProxyResponseBody(request)),
          timeoutMs: request.timeoutMs ?? requestTimeoutMs,
          ...(request.signal ? { signal: request.signal } : {}),
        },
      );

      if (!response.ok) {
        throw await createProxyError(response);
      }

      if (!response.body) {
        throw new LocalRelayError("Local Relay proxy did not return a streaming body.", {
          code: "proxy_invalid_response",
          endpoint: response.url,
        });
      }

      for await (const payload of parseServerSentEvents(response.body)) {
        const event = parseProxyPayload<ResponseStreamEvent>(payload, response.url);
        if (event.type === "error") {
          yield {
            type: "error",
            error: deserializeProxyError(event.error),
          };
          continue;
        }

        yield event;
      }
    },
  };
}

async function listModelsForProvider(
  fetchImpl: typeof fetch,
  proxyBaseUrl: string,
  options: ProviderRequestOptions,
  defaultTimeoutMs: number,
): Promise<LocalRelayModel[]> {
  const provider = options.provider ?? "openai-compatible";
  const endpoint = new URL(joinUrl(proxyBaseUrl, `/providers/${encodeURIComponent(provider)}/models`));
  if (options.baseUrl) {
    endpoint.searchParams.set("baseUrl", options.baseUrl);
  }

  const response = await requestJson<{ models: LocalRelayModel[] }>(fetchImpl, endpoint.toString(), {
    method: "GET",
    timeoutMs: options.timeoutMs ?? defaultTimeoutMs,
    ...(options.signal ? { signal: options.signal } : {}),
  });

  return response.models;
}

function resolveProxyProvider(
  request: ChatRequest | ChatStreamRequest | EmbeddingRequest | ResponseRequest | ResponseStreamRequest,
): ProviderId {
  const provider = request.provider ?? (request.baseUrl ? "openai-compatible" : undefined);
  if (!provider) {
    throw new ProviderUnavailableError("A provider is required when using the Local Relay proxy client.", {
      suggestion: "Pass provider: 'ollama', provider: 'lmstudio', or a custom baseUrl.",
    });
  }

  return provider;
}

function createProxyChatBody(request: ChatRequest | ChatStreamRequest): Record<string, unknown> {
  return {
    model: request.model,
    messages: request.messages,
    ...(request.provider ? { provider: request.provider } : {}),
    ...(request.baseUrl ? { baseUrl: request.baseUrl } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.maxTokens !== undefined ? { maxTokens: request.maxTokens } : {}),
    ...(request.tools !== undefined ? { tools: request.tools } : {}),
    ...(request.toolChoice !== undefined ? { toolChoice: request.toolChoice } : {}),
    ...(request.responseFormat !== undefined ? { responseFormat: request.responseFormat } : {}),
    ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
    ...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
    ...(request.rawOptions !== undefined ? { rawOptions: request.rawOptions } : {}),
  };
}

function createProxyEmbeddingBody(request: EmbeddingRequest): Record<string, unknown> {
  return {
    model: request.model,
    input: request.input,
    ...(request.provider ? { provider: request.provider } : {}),
    ...(request.baseUrl ? { baseUrl: request.baseUrl } : {}),
    ...(request.dimensions !== undefined ? { dimensions: request.dimensions } : {}),
    ...(request.encodingFormat !== undefined ? { encodingFormat: request.encodingFormat } : {}),
    ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
    ...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
    ...(request.rawOptions !== undefined ? { rawOptions: request.rawOptions } : {}),
  };
}

function createProxyResponseBody(request: ResponseRequest | ResponseStreamRequest): Record<string, unknown> {
  return {
    model: request.model,
    input: request.input,
    ...(request.provider ? { provider: request.provider } : {}),
    ...(request.baseUrl ? { baseUrl: request.baseUrl } : {}),
    ...(request.instructions !== undefined ? { instructions: request.instructions } : {}),
    ...(request.previousResponseId !== undefined ? { previousResponseId: request.previousResponseId } : {}),
    ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
    ...(request.maxOutputTokens !== undefined ? { maxOutputTokens: request.maxOutputTokens } : {}),
    ...(request.tools !== undefined ? { tools: request.tools } : {}),
    ...(request.toolChoice !== undefined ? { toolChoice: request.toolChoice } : {}),
    ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
    ...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
    ...(request.rawOptions !== undefined ? { rawOptions: request.rawOptions } : {}),
  };
}

async function requestJson<T>(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit & { timeoutMs: number },
): Promise<T> {
  const response = await requestFetch(fetchImpl, url, init);

  if (!response.ok) {
    throw await createProxyError(response);
  }

  return parseProxyPayload<T>(await response.text(), response.url || url);
}

async function requestFetch(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit & { timeoutMs: number },
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init.timeoutMs);
  const abortFromExternal = () => controller.abort();
  init.signal?.addEventListener("abort", abortFromExternal, { once: true });

  try {
    return await fetchImpl(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted && !init.signal?.aborted) {
      throw new LocalRelayError("Local Relay proxy request timed out.", {
        code: "proxy_timeout",
        endpoint: url,
        cause: error,
      });
    }

    throw new LocalRelayError("Local Relay proxy request failed.", {
      code: "proxy_request_failed",
      endpoint: url,
      cause: error,
      suggestion: "Start the Local Relay proxy with `npx @local-relay/proxy`.",
    });
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromExternal);
  }
}

async function createProxyError(response: Response): Promise<LocalRelayError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  const error = isProxyErrorPayload(payload) ? payload.error : undefined;
  return new LocalRelayError(error?.message ?? `Local Relay proxy returned HTTP ${response.status}.`, {
    code: error?.code ?? "proxy_error",
    endpoint: response.url,
    status: response.status,
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
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const data = extractSseData(event);
        if (data) {
          yield data;
        }
      }
    }

    const data = extractSseData(buffer);
    if (data) {
      yield data;
    }
  } finally {
    reader.releaseLock();
  }
}

function extractSseData(event: string): string {
  return event
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trimStart())
    .join("\n")
    .trim();
}

function parseProxyPayload<T>(payload: string, endpoint: string): T {
  try {
    return JSON.parse(payload) as T;
  } catch (error) {
    throw new LocalRelayError("Local Relay proxy returned invalid JSON.", {
      code: "proxy_invalid_response",
      endpoint,
      cause: error,
    });
  }
}

function deserializeProxyError(error: unknown): Error {
  if (isSerializedError(error)) {
    const deserialized = new Error(error.message);
    deserialized.name = error.code;
    return deserialized;
  }

  return new Error(String(error));
}

function isProxyErrorPayload(payload: unknown): payload is { error: { code: string; message: string } } {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    isSerializedError((payload as { error: unknown }).error)
  );
}

function isSerializedError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}
