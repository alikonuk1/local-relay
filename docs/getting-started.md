# Getting Started

Local Relay is currently an alpha TypeScript toolkit for connecting web apps to local LLM runtimes. The core, React helpers, proxy, and Vite example are implemented, but the public API is still pre-1.0.

## Install

During local development, install the workspace dependencies from the repository root:

```bash
npm install
```

When using the published packages, install only what your app needs:

```bash
npm install @local-relay/core
npm install @local-relay/react
npm install @local-relay/proxy
```

## Connect To LM Studio

1. Open LM Studio.
2. Go to the Developer area.
3. Start the local server.
4. Use Local Relay with the `lmstudio` provider.

```ts
import { createLocalRelayClient } from "@local-relay/core";

const client = createLocalRelayClient({
  providers: ["lmstudio"],
});

const models = await client.listModels();

const result = await client.chat({
  provider: "lmstudio",
  model: models[0].id,
  messages: [{ role: "user", content: "Hello from LM Studio." }],
});

console.log(result.content);
```

Provider detection uses a short default timeout so missing local servers fail quickly. Chat and streaming requests use a longer default timeout for local model generation. You can override generation timeout globally or per request:

```ts
const client = createLocalRelayClient({
  providers: ["ollama"],
  requestTimeoutMs: 120000,
});

await client.chat({
  provider: "ollama",
  model: "llama3.2",
  messages: [{ role: "user", content: "Write a short note." }],
  timeoutMs: 120000,
});
```

The default LM Studio OpenAI-compatible base URL is:

```txt
http://localhost:1234/v1
```

## Connect To Ollama

Local Relay uses Ollama's native API by default so it can read richer model metadata and loaded-model state.

```ts
const client = createLocalRelayClient({
  providers: ["ollama"],
});

const models = await client.listModels();
```

The default Ollama base URL is:

```txt
http://localhost:11434
```

If you want to use Ollama's OpenAI-compatible route instead, use the `ollama-openai` provider:

```ts
const client = createLocalRelayClient({
  providers: ["ollama-openai"],
});
```

## Custom OpenAI-Compatible Endpoint

```ts
const client = createLocalRelayClient({
  providers: [
    {
      id: "openai-compatible",
      name: "Local vLLM",
      baseUrl: "http://localhost:8000/v1",
    },
  ],
});
```

## Browser Limitations

Direct browser calls to localhost providers can fail because of CORS, mixed-content rules, or local network restrictions. Local Relay should detect and report these failures clearly, but it should not bypass browser security.

For hosted apps or browsers that cannot call local providers directly, use `@local-relay/proxy` as a local companion process.

```bash
npx @local-relay/proxy
```

```ts
import { createLocalRelayProxyClient } from "@local-relay/core";

const client = createLocalRelayProxyClient({
  baseUrl: "http://127.0.0.1:44114",
});

const result = await client.chat({
  provider: "ollama",
  model: "llama3.2",
  messages: [{ role: "user", content: "Hello through the proxy." }],
});
```
