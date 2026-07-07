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

export interface ChatMessage {
  role: ChatRole;
  content: string | ChatContentPart[];
  name?: string;
  toolCallId?: string;
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
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface ChatStreamRequest extends Omit<ChatRequest, "stream"> {
  stream?: true;
}

export interface ChatResponse {
  id?: string;
  model: string;
  provider: ProviderId;
  content: string;
  usage?: TokenUsage;
  raw?: unknown;
}

export type ChatStreamEvent =
  | { type: "start"; provider: ProviderId; model: string }
  | { type: "token"; text: string; raw?: unknown }
  | { type: "message"; content: string; raw?: unknown }
  | { type: "usage"; usage: TokenUsage; raw?: unknown }
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

export interface LocalRelayClient {
  detectProviders(options?: DetectOptions): Promise<ProviderDetectionResult[]>;
  listModels(options?: ProviderRequestOptions): Promise<LocalRelayModel[]>;
  chat(request: ChatRequest): Promise<ChatResponse>;
  streamChat(request: ChatStreamRequest): AsyncIterable<ChatStreamEvent>;
}
