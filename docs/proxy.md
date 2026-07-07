# Local Relay Proxy

`@local-relay/proxy` is an optional localhost proxy for browser integrations.

It is useful when direct browser calls to Ollama, LM Studio, or another local runtime are blocked by CORS or deployment constraints.

## CLI

```bash
npx local-relay-proxy
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
  "messages": [{ "role": "user", "content": "Hello" }]
}
```

### Streaming Chat

```http
POST /providers/ollama/chat/stream
Content-Type: application/json

{
  "model": "llama3.2",
  "messages": [{ "role": "user", "content": "Hello" }]
}
```

The streaming endpoint returns server-sent events. Each event has a JSON payload matching Local Relay's stream event shape.

## Security Defaults

- Binds to `127.0.0.1` by default.
- Refuses non-local provider URLs by default.
- Limits request bodies to 1 MB by default.
- Does not log prompts.
- Supports CORS configuration with `--allowed-origin`.

The proxy is intentionally not a remote gateway. It is a local companion process for browser apps.
