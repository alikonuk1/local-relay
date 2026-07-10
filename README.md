# Local Relay

Local Relay helps web apps connect to local LLM runtimes such as Ollama, LM Studio, llama.cpp server, vLLM, LocalAI, and other OpenAI-compatible local APIs.

It gives your app one TypeScript interface for common local-model workflows:

- Detect local providers.
- List available models.
- Send chat requests.
- Stream tokens as they are generated.
- Create embeddings.
- Use local OpenAI-compatible Responses API endpoints.
- Route browser apps through an optional localhost proxy when direct calls are blocked by CORS.

Local Relay is a connector library, not a full chat application.

## Packages

- `@local-relay/core`: provider clients, model listing, chat, streaming, embeddings, Responses API helpers, proxy client, and normalized errors.
- `@local-relay/react`: React hooks and small UI primitives for provider/model selection and streaming chat.
- `@local-relay/proxy`: a localhost companion process for browser apps that cannot call local providers directly.

## Install

```bash
npm install @local-relay/core
```

React helpers and the proxy are optional:

```bash
npm install @local-relay/react
npm install @local-relay/proxy
```

## Quick Start

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
  messages: [{ role: "user", content: "Say hello from a local model." }],
});

console.log(response.content);
```

## Streaming

```ts
for await (const event of client.streamChat({
  provider: "ollama",
  model: "llama3.2",
  messages: [{ role: "user", content: "Write one sentence." }],
})) {
  if (event.type === "token") {
    appendToTranscript(event.text);
  }
}
```

## Browser Apps

Some local runtimes do not allow direct browser requests from your app's origin. In that case, run the optional proxy on the user's machine and use the proxy client:

```bash
npx @local-relay/proxy --allowed-origin http://localhost:5173
```

```ts
import { createLocalRelayProxyClient } from "@local-relay/core";

const client = createLocalRelayProxyClient({
  baseUrl: "http://127.0.0.1:44114",
});

const models = await client.listModels({ provider: "lmstudio" });
```

The proxy binds to `127.0.0.1` by default and only forwards to local provider URLs.

## Advanced APIs

Embeddings:

```ts
const embedding = await client.embeddings({
  provider: "ollama",
  model: "nomic-embed-text",
  input: "Local-first AI",
});
```

Tools and multimodal chat content for OpenAI-compatible local providers:

```ts
const result = await client.chat({
  provider: "lmstudio",
  model: "local-tool-or-vision-model",
  messages: [
    {
      role: "user",
      content: [
        { type: "text", text: "What is in this image?" },
        { type: "image_url", image_url: { url: "data:image/png;base64,..." } },
      ],
    },
  ],
  tools: [
    {
      type: "function",
      function: {
        name: "lookupNote",
        parameters: { type: "object", properties: { id: { type: "string" } } },
      },
    },
  ],
  toolChoice: "auto",
});
```

Responses API helpers for local OpenAI-compatible servers:

```ts
const response = await client.createResponse({
  provider: "openai-compatible",
  baseUrl: "http://localhost:8000/v1",
  model: "local-responses-model",
  input: "Write a one-line summary.",
});
```

Feature support depends on the selected runtime and model. Local Relay forwards a consistent request shape, but it cannot make a provider support tools, vision, embeddings, or `/v1/responses` if that provider does not implement them.

## React

```tsx
import { createLocalRelayClient } from "@local-relay/core";
import { ModelSelector, ProviderSelector, useLocalModels } from "@local-relay/react";

const client = createLocalRelayClient({ providers: ["ollama", "lmstudio"] });

function LocalModelPicker() {
  const models = useLocalModels(client, { provider: "ollama" });

  return (
    <ModelSelector
      models={models.models}
      value={models.selectedModelId}
      onChange={models.setSelectedModelId}
    />
  );
}
```

## Example App

Run the Vite React example:

```bash
npm install
npm run dev --workspace @local-relay/example-vite-react-basic
```

The example includes provider detection, model selection, direct/proxy mode, diagnostics, and incremental streaming in a ChatGPT-style local chat UI.

## Documentation

- [Getting started](./docs/getting-started.md)
- [Provider guides](./docs/providers.md)
- [Browser limitations](./docs/browser-limitations.md)
- [CORS troubleshooting](./docs/cors-troubleshooting.md)
- [Proxy](./docs/proxy.md)
- [Error handling](./docs/error-handling.md)
- [Security](./docs/security.md)
- [Release notes](./docs/release-notes.md)

## License

MIT
