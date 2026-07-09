# Local Relay

Local Relay is a TypeScript toolkit for connecting web frontends to local LLM runtimes such as Ollama, LM Studio, llama.cpp server, and other OpenAI-compatible local APIs.

The goal is to provide the connector layer, not a full chat product. Apps should be able to detect local providers, list models, let users choose one, and stream responses with a consistent API.

## Packages

- `@local-relay/core`: provider detection, model listing, chat, streaming, and normalized errors.
- `@local-relay/react`: React hooks and lightweight UI primitives.
- `@local-relay/proxy`: optional localhost proxy for CORS and hosted app reliability.

## Current Status

Alpha-ready local development build. The core, React, proxy, docs, and Vite example are implemented, but the public API should still be treated as pre-1.0 and subject to change.

## Install

```bash
npm install @local-relay/core
```

Optional packages:

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

const detection = await client.detectProviders();
const models = await client.listModels({ provider: "ollama" });

const response = await client.chat({
  provider: "ollama",
  model: models[0].id,
  messages: [{ role: "user", content: "Say hello from a local model." }],
});
```

Streaming uses an async iterable:

```ts
for await (const event of client.streamChat({
  provider: "ollama",
  model: "llama3.2",
  messages: [{ role: "user", content: "Write one sentence." }],
})) {
  if (event.type === "token") {
    console.log(event.text);
  }
}
```

## Proxy Client

When browser-to-provider calls are blocked by CORS or deployment policy, run the optional proxy and use the proxy client with the same core API shape:

```bash
npx @local-relay/proxy
```

```ts
import { createLocalRelayProxyClient } from "@local-relay/core";

const client = createLocalRelayProxyClient({
  baseUrl: "http://127.0.0.1:44114",
});

const models = await client.listModels({ provider: "ollama" });
```

## React Helpers

```tsx
import { createLocalRelayClient } from "@local-relay/core";
import { ModelSelector, useLocalModels } from "@local-relay/react";

const client = createLocalRelayClient({ providers: ["ollama"] });

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

## Local Proxy

The proxy is useful when a browser app needs a stable localhost endpoint instead of calling Ollama or LM Studio directly.

```bash
npx @local-relay/proxy
```

Default URL:

```txt
http://127.0.0.1:44114
```

Routes:

- `GET /health`
- `GET /providers`
- `GET /providers/:provider/models`
- `POST /providers/:provider/chat`
- `POST /providers/:provider/chat/stream`

The proxy binds to `127.0.0.1` by default and refuses non-local provider URLs by default.

## Example App

Run the Vite React example locally:

```bash
npm install
npm run dev --workspace @local-relay/example-vite-react-basic
```

The example includes provider detection, model selection, direct Ollama calls, a diagnostics panel, and incremental streaming in a ChatGPT-style local chat UI.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

The packages build with TypeScript directly and tests use Node's built-in test runner.

Optional real-provider tests:

```bash
LOCAL_RELAY_TEST_OLLAMA=1 npm test --workspace @local-relay/core
LOCAL_RELAY_TEST_LMSTUDIO=1 npm test --workspace @local-relay/core
```

## Docs

- [Getting started](./docs/getting-started.md)
- [Provider guides](./docs/providers.md)
- [Browser limitations](./docs/browser-limitations.md)
- [CORS troubleshooting](./docs/cors-troubleshooting.md)
- [Proxy](./docs/proxy.md)
- [Error handling](./docs/error-handling.md)
- [Security](./docs/security.md)
- [API stability notes](./docs/api-review.md)
- [Integration tests](./docs/integration-tests.md)
- [Publishing](./docs/publishing.md)
- [Release notes](./docs/release-notes.md)
