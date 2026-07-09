# @local-relay/core

Core TypeScript client for connecting web apps to local LLM providers.

## Status

`0.1.0` alpha. The API is pre-1.0 and may change.

## Usage

```ts
import { createLocalRelayClient } from "@local-relay/core";

const client = createLocalRelayClient({
  providers: ["ollama", "lmstudio"],
});

const providers = await client.detectProviders();
const models = await client.listModels({ provider: "ollama" });

const response = await client.chat({
  provider: "ollama",
  model: models[0].id,
  messages: [{ role: "user", content: "Say hello." }],
  timeoutMs: 60000,
});
```

## Advanced APIs

```ts
const embedding = await client.embeddings({
  provider: "ollama",
  model: "nomic-embed-text",
  input: "Local-first AI",
});
```

```ts
const response = await client.createResponse({
  provider: "openai-compatible",
  baseUrl: "http://localhost:8000/v1",
  model: "local-responses-model",
  input: "Summarize this locally.",
});
```

Chat requests also support OpenAI-compatible `tools`, `toolChoice`, `responseFormat`, and multimodal `content` parts.

## Proxy Client

```ts
import { createLocalRelayProxyClient } from "@local-relay/core";

const client = createLocalRelayProxyClient({
  baseUrl: "http://127.0.0.1:44114",
});

const models = await client.listModels({ provider: "ollama" });
```

See the repository README for provider, proxy, and browser limitation docs.
