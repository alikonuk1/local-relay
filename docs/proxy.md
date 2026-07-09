# Local Relay Proxy

`@local-relay/proxy` is an optional localhost proxy for browser integrations.

It is useful when direct browser calls to Ollama, LM Studio, or another local runtime are blocked by CORS or deployment constraints.

## CLI

```bash
npx @local-relay/proxy
```

Default bind address:

```txt
http://127.0.0.1:44114
```

Options:

```bash
local-relay-proxy --host 127.0.0.1 --port 44114
local-relay-proxy --allowed-origin https://your-app.example
local-relay-proxy --max-body-bytes 1048576
```

Use explicit allowed origins for product integrations:

```bash
npx @local-relay/proxy --allowed-origin https://your-app.example
```

## Endpoints

### Health

```http
GET /health
```

### Detect Providers

```http
GET /providers
```

### List Models

```http
GET /providers/ollama/models
GET /providers/lmstudio/models
```

### Chat

```http
POST /providers/ollama/chat
Content-Type: application/json

{
  "model": "llama3.2",
  "messages": [{ "role": "user", "content": "Hello" }],
  "timeoutMs": 60000
}
```

### Streaming Chat

```http
POST /providers/ollama/chat/stream
Content-Type: application/json

{
  "model": "llama3.2",
  "messages": [{ "role": "user", "content": "Hello" }],
  "timeoutMs": 60000
}
```

The streaming endpoint returns server-sent events. Each event has a JSON payload matching Local Relay's stream event shape.

### Embeddings

```http
POST /providers/ollama/embeddings
Content-Type: application/json

{
  "model": "nomic-embed-text",
  "input": "Hello",
  "timeoutMs": 60000
}
```

### Responses API

```http
POST /providers/openai-compatible/responses
Content-Type: application/json

{
  "baseUrl": "http://localhost:8000/v1",
  "model": "local-responses-model",
  "input": "Write one sentence.",
  "tools": [{ "type": "function", "name": "lookup" }]
}
```

```http
POST /providers/openai-compatible/responses/stream
Content-Type: application/json

{
  "baseUrl": "http://localhost:8000/v1",
  "model": "local-responses-model",
  "input": "Write one sentence."
}
```

The Responses streaming endpoint returns server-sent events with Local Relay response stream event payloads.

## Browser Client

Use `createLocalRelayProxyClient` from `@local-relay/core` when a browser app should talk to the proxy instead of calling Ollama or LM Studio directly.

```ts
import { createLocalRelayProxyClient } from "@local-relay/core";

const client = createLocalRelayProxyClient({
  baseUrl: "http://127.0.0.1:44114",
});

const providers = await client.detectProviders();
const models = await client.listModels({ provider: "ollama" });
const embedding = await client.embeddings({
  provider: "ollama",
  model: "nomic-embed-text",
  input: "Local-first AI",
});

for await (const event of client.streamChat({
  provider: "ollama",
  model: models[0].id,
  messages: [{ role: "user", content: "Write one sentence." }],
})) {
  if (event.type === "token") {
    console.log(event.text);
  }
}
```

## Security Defaults

- Binds to `127.0.0.1` by default.
- Refuses non-local provider URLs by default.
- Limits request bodies to 1 MB by default.
- Does not log prompts.
- Supports CORS configuration with `--allowed-origin`.

The proxy is intentionally not a remote gateway. It is a local companion process for browser apps.
