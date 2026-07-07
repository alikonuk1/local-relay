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
npx local-relay-proxy
```

Then point the web app at the proxy endpoints instead of calling Ollama or LM Studio directly.

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
- Use `@local-relay/proxy` if direct browser requests fail.
