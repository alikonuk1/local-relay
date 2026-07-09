import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { parseArgs } from "node:util";
import { createLocalRelayClient } from "@local-relay/core";
import type {
  BuiltInProviderId,
  ChatStreamEvent,
  CreateLocalRelayClientOptions,
  LocalRelayClient,
  ProviderConfig,
  ProviderId,
} from "@local-relay/core";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 44114;
const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1"]);

export interface LocalRelayProxyOptions {
  host?: string;
  port?: number;
  client?: LocalRelayClient;
  providers?: CreateLocalRelayClientOptions["providers"];
  allowedOrigins?: string[];
  maxBodyBytes?: number;
  fetch?: typeof fetch;
}

export interface LocalRelayProxy {
  server: Server;
  host: string;
  port: number;
  url: string;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

interface ParsedBody {
  model?: unknown;
  messages?: unknown;
  provider?: unknown;
  baseUrl?: unknown;
  temperature?: unknown;
  maxTokens?: unknown;
  timeoutMs?: unknown;
}

export function createLocalRelayProxy(options: LocalRelayProxyOptions = {}): LocalRelayProxy {
  const host = options.host ?? DEFAULT_HOST;
  const port = options.port ?? DEFAULT_PORT;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const client =
    options.client ??
    createLocalRelayClient({
      ...(options.providers ? { providers: options.providers } : {}),
      ...(options.fetch ? { fetch: options.fetch } : {}),
    });

  assertSafeBindHost(host);
  assertSafeProviders(options.providers);

  const server = createServer((request, response) => {
    void handleRequest(request, response, {
      client,
      allowedOrigins: options.allowedOrigins ?? ["*"],
      maxBodyBytes,
    });
  });

  return {
    server,
    host,
    port,
    url: `http://${host}:${port}`,
    start: () =>
      new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve();
        });
      }),
    stop: () =>
      new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      }),
  };
}

export function parseCliOptions(argv = process.argv.slice(2)): LocalRelayProxyOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      host: { type: "string" },
      port: { type: "string" },
      "allowed-origin": { type: "string", multiple: true },
      "max-body-bytes": { type: "string" },
    },
    strict: true,
    allowPositionals: false,
  });

  return {
    ...(values.host ? { host: values.host } : {}),
    ...(values.port ? { port: parsePort(values.port) } : {}),
    ...(values["allowed-origin"] ? { allowedOrigins: values["allowed-origin"] } : {}),
    ...(values["max-body-bytes"] ? { maxBodyBytes: parsePositiveInteger(values["max-body-bytes"]) } : {}),
  };
}

interface RequestContext {
  client: LocalRelayClient;
  allowedOrigins: string[];
  maxBodyBytes: number;
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  context: RequestContext,
): Promise<void> {
  setCorsHeaders(request, response, context.allowedOrigins);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);

    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, { ok: true, service: "local-relay-proxy" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/providers") {
      writeJson(response, 200, { providers: await context.client.detectProviders() });
      return;
    }

    if (request.method === "GET" && parts.length === 3 && parts[0] === "providers" && parts[2] === "models") {
      const provider = decodeURIComponent(parts[1] ?? "");
      const baseUrl = url.searchParams.get("baseUrl");
      if (baseUrl) {
        assertLocalUrl(baseUrl);
      }
      writeJson(response, 200, {
        models: await context.client.listModels({
          provider,
          ...(baseUrl ? { baseUrl } : {}),
        }),
      });
      return;
    }

    if (request.method === "POST" && parts.length === 3 && parts[0] === "providers" && parts[2] === "chat") {
      const provider = decodeURIComponent(parts[1] ?? "");
      const body = await readJsonBody(request, context.maxBodyBytes);
      const chatRequest = toChatRequest(provider, body);
      writeJson(response, 200, { response: await context.client.chat(chatRequest) });
      return;
    }

    if (
      request.method === "POST" &&
      parts.length === 4 &&
      parts[0] === "providers" &&
      parts[2] === "chat" &&
      parts[3] === "stream"
    ) {
      const provider = decodeURIComponent(parts[1] ?? "");
      const body = await readJsonBody(request, context.maxBodyBytes);
      const chatRequest = toChatRequest(provider, body);
      await writeEventStream(response, context.client.streamChat(chatRequest));
      return;
    }

    if (url.pathname === "/health" || url.pathname === "/providers" || parts[0] === "providers") {
      writeJson(response, 405, {
        error: {
          code: "method_not_allowed",
          message: "Method not allowed for this route.",
        },
      });
      return;
    }

    writeJson(response, 404, { error: { code: "not_found", message: "Route not found." } });
  } catch (error) {
    writeError(response, error);
  }
}

function toChatRequest(providerFromPath: ProviderId, body: ParsedBody) {
  if (typeof body.model !== "string" || !Array.isArray(body.messages)) {
    throw new ProxyRequestError(400, "invalid_request", "Request body requires model and messages.");
  }

  if (typeof body.baseUrl === "string") {
    assertLocalUrl(body.baseUrl);
  }

  return {
    provider: typeof body.provider === "string" ? body.provider : providerFromPath,
    model: body.model,
    messages: body.messages,
    ...(typeof body.baseUrl === "string" ? { baseUrl: body.baseUrl } : {}),
    ...(typeof body.temperature === "number" ? { temperature: body.temperature } : {}),
    ...(typeof body.maxTokens === "number" ? { maxTokens: body.maxTokens } : {}),
    ...(typeof body.timeoutMs === "number" ? { timeoutMs: body.timeoutMs } : {}),
  };
}

async function writeEventStream(
  response: ServerResponse,
  events: AsyncIterable<ChatStreamEvent>,
): Promise<void> {
  response.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  try {
    for await (const event of events) {
      response.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (error) {
    response.write(
      `data: ${JSON.stringify({
        type: "error",
        error: serializeError(error),
      })}\n\n`,
    );
  } finally {
    response.end();
  }
}

async function readJsonBody(request: IncomingMessage, maxBodyBytes: number): Promise<ParsedBody> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;

    if (size > maxBodyBytes) {
      throw new ProxyRequestError(413, "request_too_large", "Request body is too large.");
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    throw new ProxyRequestError(400, "invalid_json", "Request body is required.");
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as ParsedBody;
  } catch (error) {
    throw new ProxyRequestError(400, "invalid_json", "Request body must be valid JSON.", error);
  }
}

function writeJson(response: ServerResponse, status: number, payload: unknown): void {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function writeError(response: ServerResponse, error: unknown): void {
  if (error instanceof ProxyRequestError) {
    writeJson(response, error.status, {
      error: {
        code: error.code,
        message: error.message,
      },
    });
    return;
  }

  writeJson(response, 500, {
    error: serializeError(error),
  });
}

function serializeError(error: unknown): { code: string; message: string } {
  if (error instanceof Error) {
    const code = "code" in error && typeof error.code === "string" ? error.code : "internal_error";
    return { code, message: error.message };
  }

  return { code: "internal_error", message: String(error) };
}

function setCorsHeaders(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: string[],
): void {
  const origin = request.headers.origin;
  const allowAny = allowedOrigins.includes("*");
  const allowedOrigin = origin && (allowAny || allowedOrigins.includes(origin)) ? origin : allowAny ? "*" : "";

  if (allowedOrigin) {
    response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  }

  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  response.setHeader("Access-Control-Max-Age", "600");
}

function assertSafeBindHost(host: string): void {
  if (!LOCAL_HOSTNAMES.has(host)) {
    throw new ProxyRequestError(
      400,
      "unsafe_bind_host",
      "Local Relay proxy only binds to localhost by default.",
    );
  }
}

function assertSafeProviders(providers: CreateLocalRelayClientOptions["providers"]): void {
  for (const provider of providers ?? []) {
    if (typeof provider !== "string" && provider.baseUrl) {
      assertLocalUrl(provider.baseUrl);
    }
  }
}

function assertLocalUrl(rawUrl: string): void {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch (error) {
    throw new ProxyRequestError(400, "invalid_url", "Provider baseUrl must be a valid URL.", error);
  }

  if (!LOCAL_HOSTNAMES.has(url.hostname)) {
    throw new ProxyRequestError(
      400,
      "unsafe_provider_url",
      "Local Relay proxy only forwards to localhost provider URLs by default.",
    );
  }
}

function parsePort(value: string): number {
  const port = parsePositiveInteger(value);
  if (port > 65535) {
    throw new Error("Port must be between 1 and 65535.");
  }

  return port;
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Expected a positive integer.");
  }

  return parsed;
}

class ProxyRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "ProxyRequestError";
    if (cause !== undefined) {
      this.cause = cause;
    }
  }
}

export type { BuiltInProviderId, ProviderConfig };
