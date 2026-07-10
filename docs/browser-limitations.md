# Browser Limitations

Browser apps do not always have permission to call local LLM servers directly, even when those servers are running and reachable from the same machine.

Local Relay supports direct browser connections where they work and provides a localhost proxy for cases where the browser blocks the request.

## Why Direct Calls Fail

Common causes:

- The provider does not allow your app's origin with CORS headers.
- A hosted HTTPS page is trying to call an HTTP localhost URL.
- The browser restricts private network or localhost access from the current context.
- The provider server is running, but the API server or model is not loaded.

## Default Local URLs

- Ollama: `http://localhost:11434`
- Ollama OpenAI-compatible: `http://localhost:11434/v1`
- LM Studio: `http://localhost:1234/v1`

## Recommended Browser Setup

For installed apps, local tools, and trusted same-machine workflows, direct mode can work:

```ts
import { createLocalRelayClient } from "@local-relay/core";

const client = createLocalRelayClient({
  providers: ["ollama", "lmstudio"],
});
```

For hosted web apps or providers that do not send CORS headers, use the proxy client:

```bash
npx @local-relay/proxy --allowed-origin https://your-app.example
```

```ts
import { createLocalRelayProxyClient } from "@local-relay/core";

const client = createLocalRelayProxyClient({
  baseUrl: "http://127.0.0.1:44114",
});
```

## What The Proxy Does

The proxy provides a stable browser-facing localhost endpoint and forwards requests to local providers. It is not a remote gateway and does not bypass browser security for arbitrary networks.

By default, it:

- Binds to `127.0.0.1`.
- Forwards only to local provider URLs.
- Does not log prompts or responses.
- Limits request body size.
- Supports explicit CORS origins.

See [proxy.md](./proxy.md) for setup details.
