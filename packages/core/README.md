# @local-relay/core

Core TypeScript client for connecting apps to local LLM providers.

## Install

```bash
npm install @local-relay/core
```

## Direct Client

```ts
import { createLocalRelayClient } from "@local-relay/core";

const client = createLocalRelayClient({
  providers: ["ollama", "lmstudio"],
});

const models = await client.listModels({ provider: "ollama" });

const response = await client.chat({
  provider: "ollama",
  model: models[0].id,
  messages: [{ role: "user", content: "Say hello." }],
});

console.log(response.content);
```

## Streaming

```ts
for await (const event of client.streamChat({
  provider: "lmstudio",
  model: "local-chat-model",
  messages: [{ role: "user", content: "Write one sentence." }],
})) {
  if (event.type === "token") {
    process.stdout.write(event.text);
  }
}
```

## Proxy Client

Use the proxy client when a browser app talks through `@local-relay/proxy`.

```ts
import { createLocalRelayProxyClient } from "@local-relay/core";

const client = createLocalRelayProxyClient({
  baseUrl: "http://127.0.0.1:44114",
});

const models = await client.listModels({ provider: "lmstudio" });
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

Chat requests also support OpenAI-compatible `tools`, `toolChoice`, `responseFormat`, and multimodal `content` parts where the selected provider supports them.

See the repository README for provider, proxy, browser, and security guides.
