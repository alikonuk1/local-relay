# Getting Started

Use Local Relay when your web app needs to talk to local LLM runtimes with one consistent TypeScript API.

## Install

Install the core package:

```bash
npm install @local-relay/core
```

Add React helpers or the browser proxy only if your app needs them:

```bash
npm install @local-relay/react
npm install @local-relay/proxy
```

Package pages:

- [`@local-relay/core`](https://www.npmjs.com/package/@local-relay/core)
- [`@local-relay/react`](https://www.npmjs.com/package/@local-relay/react)
- [`@local-relay/proxy`](https://www.npmjs.com/package/@local-relay/proxy)

## Choose A Provider

Local Relay includes built-in provider IDs for common local runtimes:

- `ollama`
- `ollama-openai`
- `lmstudio`
- `openai-compatible`

```ts
import { createLocalRelayClient } from "@local-relay/core";

const client = createLocalRelayClient({
  providers: ["ollama", "lmstudio"],
});
```

## Detect Providers

Provider detection lets your app show users which local runtimes are currently reachable.

```ts
const providers = await client.detectProviders();

for (const result of providers) {
  console.log(result.provider.id, result.provider.status);
}
```

Statuses are normalized as `available`, `unavailable`, `blocked`, or `unknown`.

## List Models

```ts
const models = await client.listModels({ provider: "lmstudio" });
const selectedModel = models[0];
```

For LM Studio, make sure the local server is running from the Developer area and a chat model is loaded. The default URL is:

```txt
http://localhost:1234/v1
```

For Ollama, make sure Ollama is running and at least one model is installed. The default URL is:

```txt
http://localhost:11434
```

## Send A Chat Request

```ts
const response = await client.chat({
  provider: "lmstudio",
  model: selectedModel.id,
  messages: [{ role: "user", content: "Explain local inference in one sentence." }],
});

console.log(response.content);
```

## Stream A Response

```ts
for await (const event of client.streamChat({
  provider: "lmstudio",
  model: selectedModel.id,
  messages: [{ role: "user", content: "Write a short welcome message." }],
})) {
  if (event.type === "token") {
    appendToTranscript(event.text);
  }
}
```

## Adjust Timeouts

Provider detection and model listing use short timeouts so unavailable local servers fail quickly. Chat and streaming requests use a longer timeout because local model generation can take longer.

```ts
const client = createLocalRelayClient({
  providers: ["ollama"],
  timeoutMs: 3000,
  requestTimeoutMs: 120000,
});

await client.chat({
  provider: "ollama",
  model: "llama3.2",
  messages: [{ role: "user", content: "Write a short note." }],
  timeoutMs: 120000,
});
```

## Use The Browser Proxy

Direct browser calls to local providers can fail because of CORS or browser policy. Use the Local Relay proxy when your browser app cannot call Ollama or LM Studio directly.

Start the proxy on the user's machine:

```bash
npx @local-relay/proxy --allowed-origin http://localhost:5173
```

Use the proxy client in your app:

```ts
import { createLocalRelayProxyClient } from "@local-relay/core";

const client = createLocalRelayProxyClient({
  baseUrl: "http://127.0.0.1:44114",
});

const models = await client.listModels({ provider: "lmstudio" });
```

The proxy supports the same client methods for model listing, chat, streaming chat, embeddings, and Responses API calls.

## Advanced Local APIs

Embeddings:

```ts
const embedding = await client.embeddings({
  provider: "ollama",
  model: "nomic-embed-text",
  input: "Local-first AI",
});
```

Responses API on a local OpenAI-compatible server:

```ts
const response = await client.createResponse({
  provider: "openai-compatible",
  baseUrl: "http://localhost:8000/v1",
  model: "local-responses-model",
  input: "Write one concise sentence.",
});
```

Tools and multimodal chat content are passed through to OpenAI-compatible providers. Actual behavior depends on the local runtime and model.
