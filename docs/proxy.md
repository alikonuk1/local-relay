# Local Relay Proxy

`@local-relay/proxy` is a localhost companion process for browser apps. Use it when direct browser requests to Ollama, LM Studio, or another local runtime are blocked by CORS or browser policy.

## Start The Proxy

```bash
npx @local-relay/proxy
```

Default URL:

```txt
http://127.0.0.1:44114
```

For a browser app, pass the allowed origin explicitly:

```bash
npx @local-relay/proxy --allowed-origin http://localhost:5173
```

For a hosted app:

```bash
npx @local-relay/proxy --allowed-origin https://your-app.example
```

## CLI Options

```bash
local-relay-proxy --host 127.0.0.1 --port 44114
local-relay-proxy --allowed-origin https://your-app.example
local-relay-proxy --max-body-bytes 1048576
```

The proxy is intended for localhost use. It binds to `127.0.0.1` by default and rejects non-local provider URLs by default.

## Use From A Browser App

```ts
import { createLocalRelayProxyClient } from "@local-relay/core";

const client = createLocalRelayProxyClient({
  baseUrl: "http://127.0.0.1:44114",
});

const providers = await client.detectProviders();
const models = await client.listModels({ provider: "lmstudio" });
```

The proxy client supports the same main methods as the direct client:

- `detectProviders`
- `listModels`
- `chat`
- `streamChat`
- `embeddings`
- `createResponse`
- `streamResponse`

## Streaming Chat

```ts
for await (const event of client.streamChat({
  provider: "lmstudio",
  model: "local-chat-model",
  messages: [{ role: "user", content: "Write one sentence." }],
})) {
  if (event.type === "token") {
    appendToTranscript(event.text);
  }
}
```

## HTTP Routes

The proxy exposes these routes for clients that want to call HTTP directly.

```http
GET /health
GET /providers
GET /providers/:provider/models
POST /providers/:provider/chat
POST /providers/:provider/chat/stream
POST /providers/:provider/embeddings
POST /providers/:provider/responses
POST /providers/:provider/responses/stream
```

Example chat request:

```http
POST /providers/ollama/chat
Content-Type: application/json

{
  "model": "llama3.2",
  "messages": [{ "role": "user", "content": "Hello" }],
  "timeoutMs": 60000
}
```

Streaming routes return server-sent events. Each event contains a JSON payload matching Local Relay's stream event shape.

## Custom Local Base URLs

Use `baseUrl` when forwarding to a custom local OpenAI-compatible provider:

```ts
const models = await client.listModels({
  provider: "openai-compatible",
  baseUrl: "http://localhost:8000/v1",
});
```

The proxy validates `baseUrl` and rejects non-local hosts by default.

## Security Defaults

- Binds to `127.0.0.1` by default.
- Forwards only to local provider URLs by default.
- Limits request bodies to 1 MB by default.
- Does not log prompts or responses.
- Supports explicit CORS origins with `--allowed-origin`.

The proxy is not a remote gateway.
