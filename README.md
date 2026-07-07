# Local Relay

Local Relay is a TypeScript toolkit for connecting web frontends to local LLM runtimes such as Ollama, LM Studio, llama.cpp server, and other OpenAI-compatible local APIs.

The goal is to provide the connector layer, not a full chat product. Apps should be able to detect local providers, list models, let users choose one, and stream responses with a consistent API.

## Planned Packages

- `@local-relay/core`: provider detection, model listing, chat, streaming, and normalized errors.
- `@local-relay/react`: React hooks and lightweight UI primitives.
- `@local-relay/proxy`: optional localhost proxy for CORS and hosted app reliability.

## Current Status

Early scaffold. The first implementation slice is focused on `@local-relay/core`.

## Current Core API

```ts
import { createLocalRelayClient } from "@local-relay/core";

const client = createLocalRelayClient({
  providers: ["ollama", "lmstudio"],
});

const detection = await client.detectProviders();
const models = await client.listModels({ provider: "lmstudio" });

const response = await client.chat({
  provider: "lmstudio",
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
npx local-relay-proxy
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

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
```

The package currently typechecks with TypeScript directly:

```bash
tsc -p packages/core/tsconfig.json --noEmit
```

## Docs

- [Handover / next-session notes](./handover.md)
- [Getting started](./docs/getting-started.md)
- [Provider guides](./docs/providers.md)
- [Browser limitations](./docs/browser-limitations.md)
- [CORS troubleshooting](./docs/cors-troubleshooting.md)
- [Proxy](./docs/proxy.md)
- [Error handling](./docs/error-handling.md)
- [Security](./docs/security.md)
- [Integration tests](./docs/integration-tests.md)
- [Publishing prep](./docs/publishing.md)
