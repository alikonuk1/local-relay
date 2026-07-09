export type BuiltInProviderId = "ollama" | "ollama-openai" | "lmstudio" | "openai-compatible";
export type ProviderId = BuiltInProviderId | (string & {});

export type ProviderStatus = "unknown" | "available" | "unavailable" | "blocked";

export type ProviderCapability =
  | "chat"
  | "chat-streaming"
  | "embeddings"
  | "model-list"
  | "responses-api"
  | "tools"
  | "vision"
  | "json-mode";

export interface LocalRelayProvider {
  id: ProviderId;
  name: string;
  baseUrl: string;
  status: ProviderStatus;
  capabilities: ProviderCapability[];
  metadata?: Record<string, unknown>;
}

export interface LocalRelayModel {
  id: string;
  name: string;
  provider: ProviderId;
  family?: string;
  parameterSize?: string;
  quantization?: string;
  contextLength?: number;
  loaded?: boolean;
  raw?: unknown;
}

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ChatTextPart {
  type: "text";
  text: string;
}

export interface ChatImagePart {
  type: "image_url";
  image_url: string | { url: string };
}

export type ChatContentPart = ChatTextPart | ChatImagePart;

export interface ChatFunctionTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export type ChatTool = ChatFunctionTool | Record<string, unknown>;
export type ChatToolChoice = "auto" | "none" | "required" | Record<string, unknown>;

export interface ChatToolCall {
  id: string;
  type: "function" | string;
  function?: {
    name: string;
    arguments: string;
  };
  raw?: unknown;
}

export interface ChatMessage {
  role: ChatRole;
  content: string | ChatContentPart[];
  name?: string;
  toolCallId?: string;
  toolCalls?: ChatToolCall[];
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  raw?: unknown;
}

export interface ChatRequest {
  provider?: ProviderId;
  baseUrl?: string;
  model: string;
  messages: ChatMessage[];
  stream?: false;
  temperature?: number;
  maxTokens?: number;
  tools?: ChatTool[];
  toolChoice?: ChatToolChoice;
  responseFormat?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
  rawOptions?: Record<string, unknown>;
}

export interface ChatStreamRequest extends Omit<ChatRequest, "stream"> {
  stream?: true;
}

export interface ChatResponse {
  id?: string;
  model: string;
  provider: ProviderId;
  content: string;
  toolCalls?: ChatToolCall[];
  finishReason?: string;
  usage?: TokenUsage;
  raw?: unknown;
}

export type ChatStreamEvent =
  | { type: "start"; provider: ProviderId; model: string }
  | { type: "token"; text: string; raw?: unknown }
  | { type: "tool-call"; toolCall: ChatToolCall; raw?: unknown }
  | { type: "message"; content: string; raw?: unknown }
  | { type: "usage"; usage: TokenUsage; raw?: unknown }
  | { type: "error"; error: Error }
  | { type: "done"; raw?: unknown };

export type EmbeddingInput = string | string[] | number[] | number[][];
export type EmbeddingEncodingFormat = "float" | "base64";

export interface EmbeddingRequest {
  provider?: ProviderId;
  baseUrl?: string;
  model: string;
  input: EmbeddingInput;
  dimensions?: number;
  encodingFormat?: EmbeddingEncodingFormat;
  timeoutMs?: number;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
  rawOptions?: Record<string, unknown>;
}

export interface Embedding {
  index: number;
  embedding: number[] | string;
  object?: string;
  raw?: unknown;
}

export interface EmbeddingResponse {
  model: string;
  provider: ProviderId;
  data: Embedding[];
  usage?: TokenUsage;
  raw?: unknown;
}

export type ResponseInput = string | unknown[];
export type ResponseTool = Record<string, unknown>;
export type ResponseToolChoice = string | Record<string, unknown>;

export interface ResponseRequest {
  provider?: ProviderId;
  baseUrl?: string;
  model: string;
  input: ResponseInput;
  instructions?: string;
  previousResponseId?: string;
  temperature?: number;
  maxOutputTokens?: number;
  tools?: ResponseTool[];
  toolChoice?: ResponseToolChoice;
  stream?: false;
  timeoutMs?: number;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
  rawOptions?: Record<string, unknown>;
}

export interface ResponseStreamRequest extends Omit<ResponseRequest, "stream"> {
  stream?: true;
}

export interface ResponseOutputItem {
  id?: string;
  type: string;
  role?: string;
  content?: unknown;
  name?: string;
  arguments?: string;
  callId?: string;
  raw?: unknown;
}

export interface LocalRelayResponse {
  id?: string;
  model: string;
  provider: ProviderId;
  output: ResponseOutputItem[];
  outputText?: string;
  usage?: TokenUsage;
  raw?: unknown;
}

export type ResponseStreamEvent =
  | { type: "start"; provider: ProviderId; model: string }
  | { type: "response-event"; event: string; raw: unknown }
  | { type: "text-delta"; text: string; raw?: unknown }
  | { type: "error"; error: Error }
  | { type: "done"; raw?: unknown };

export interface DetectOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ProviderRequestOptions {
  provider?: ProviderId;
  baseUrl?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface ProviderDetectionResult {
  provider: LocalRelayProvider;
  error?: Error;
}

export interface ProviderConfig {
  id: ProviderId;
  name?: string;
  baseUrl?: string;
  capabilities?: ProviderCapability[];
  adapter?: ProviderAdapter;
}

export interface CreateLocalRelayClientOptions {
  providers?: Array<BuiltInProviderId | ProviderConfig>;
  timeoutMs?: number;
  requestTimeoutMs?: number;
  fetch?: typeof fetch;
}

export interface CreateLocalRelayProxyClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
  requestTimeoutMs?: number;
  fetch?: typeof fetch;
}

export interface ProviderAdapter {
  id: ProviderId;
  name: string;
  defaultBaseUrls: string[];
  capabilities: ProviderCapability[];
  detect(options: AdapterRequestOptions): Promise<ProviderDetectionResult>;
  listModels(options: AdapterRequestOptions): Promise<LocalRelayModel[]>;
  chat(request: AdapterChatRequest): Promise<ChatResponse>;
  streamChat(request: AdapterChatRequest): AsyncIterable<ChatStreamEvent>;
  embeddings(request: AdapterEmbeddingRequest): Promise<EmbeddingResponse>;
  createResponse(request: AdapterResponseRequest): Promise<LocalRelayResponse>;
  streamResponse(request: AdapterResponseRequest): AsyncIterable<ResponseStreamEvent>;
}

export interface AdapterRequestOptions {
  provider: LocalRelayProvider;
  fetch: typeof fetch;
  timeoutMs: number;
  signal?: AbortSignal;
}

export interface AdapterChatRequest extends AdapterRequestOptions {
  request: ChatRequest | ChatStreamRequest;
}

export interface AdapterEmbeddingRequest extends AdapterRequestOptions {
  request: EmbeddingRequest;
}

export interface AdapterResponseRequest extends AdapterRequestOptions {
  request: ResponseRequest | ResponseStreamRequest;
}

export interface LocalRelayClient {
  detectProviders(options?: DetectOptions): Promise<ProviderDetectionResult[]>;
  listModels(options?: ProviderRequestOptions): Promise<LocalRelayModel[]>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  streamChat(request: ChatStreamRequest): AsyncIterable<ChatStreamEvent>;
  embeddings(request: EmbeddingRequest): Promise<EmbeddingResponse>;
  createResponse(request: ResponseRequest): Promise<LocalRelayResponse>;
  streamResponse(request: ResponseStreamRequest): AsyncIterable<ResponseStreamEvent>;
}
