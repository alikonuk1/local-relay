# CORS Troubleshooting

Direct browser calls to local LLM runtimes can fail even when the runtime is healthy.

Common causes:

- The local provider does not allow the web app's origin.
- A hosted HTTPS app is trying to reach a local HTTP URL.
- The browser blocks or restricts localhost access from the current context.
- A provider is running, but its API server is disabled.

## Symptoms

In Local Relay, these failures usually surface as `ProviderCorsError`, `ProviderUnavailableError`, or `ProviderTimeoutError`.

## Recommended Fixes

### Use The Proxy

Run:

```bash
npx @local-relay/proxy
```

Then use the proxy client from `@local-relay/core`:

```ts
import { createLocalRelayProxyClient } from "@local-relay/core";

const client = createLocalRelayProxyClient({
  baseUrl: "http://127.0.0.1:44114",
});
```

### Check Provider Server State

For Ollama:

```bash
curl http://localhost:11434/api/version
```

For LM Studio:

```bash
curl http://localhost:1234/v1/models
```

### Keep Provider URLs Local

Local Relay's proxy refuses non-local provider URLs by default. This is intentional.

Allowed examples:

- `http://localhost:11434`
- `http://127.0.0.1:1234/v1`
- `http://[::1]:8000/v1`

Rejected examples:

- `https://example.com/v1`
- `http://192.168.1.25:11434`

## Development Checklist

- Confirm the provider server is running.
- Confirm the provider URL works with `curl`.
- Confirm the browser app uses the right provider id.
- Use `@local-relay/proxy` and `createLocalRelayProxyClient` if direct browser requests fail.
