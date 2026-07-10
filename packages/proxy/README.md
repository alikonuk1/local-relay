# @local-relay/proxy

Localhost companion process for Local Relay browser integrations.

Use this package when a browser app cannot call Ollama, LM Studio, or another local provider directly because of CORS or browser policy.

## Run

```bash
npx @local-relay/proxy --allowed-origin http://localhost:5173
```

Default URL:

```txt
http://127.0.0.1:44114
```

## Use From The Browser

```ts
import { createLocalRelayProxyClient } from "@local-relay/core";

const client = createLocalRelayProxyClient({
  baseUrl: "http://127.0.0.1:44114",
});

const models = await client.listModels({ provider: "lmstudio" });
```

The proxy forwards provider detection, model listing, chat, streaming chat, embeddings, Responses API calls, and streaming Responses API events.

## Defaults

- Binds to `127.0.0.1`.
- Rejects non-local provider URLs.
- Does not log prompts or responses.
- Limits request body size.

See the repository README for setup, browser, and security guides.
