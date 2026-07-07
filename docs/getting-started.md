# Getting Started

Local Relay is currently focused on the core TypeScript connector layer.

## Install

Package publishing is not set up yet. During local development, use the monorepo workspace package:

```bash
npm install
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

For production hosted apps, use the experimental `@local-relay/proxy` package as a local companion/proxy option.
