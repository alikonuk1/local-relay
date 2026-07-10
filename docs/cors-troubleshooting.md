# CORS Troubleshooting

If a local provider works with `curl` but fails from your browser app, the provider is probably not allowing the browser origin. This is common with local AI runtimes.

## Symptoms

Your app may see one of these Local Relay errors:

- `ProviderCorsError`
- `ProviderUnavailableError`
- `ProviderTimeoutError`

The browser console may also show a CORS or network error for a localhost URL.

## Check The Provider

Ollama:

```bash
curl http://localhost:11434/api/version
curl http://localhost:11434/api/tags
```

LM Studio:

```bash
curl http://localhost:1234/v1/models
```

If the command fails, start the provider or load a model before debugging CORS.

## Use The Local Relay Proxy

Start the proxy:

```bash
npx @local-relay/proxy --allowed-origin http://localhost:5173
```

Use the proxy client:

```ts
import { createLocalRelayProxyClient } from "@local-relay/core";

const client = createLocalRelayProxyClient({
  baseUrl: "http://127.0.0.1:44114",
});

const models = await client.listModels({ provider: "lmstudio" });
```

Use your production app origin with `--allowed-origin` when deploying a hosted integration.

## Keep Provider URLs Local

The proxy only forwards to local provider URLs by default.

Allowed examples:

- `http://localhost:11434`
- `http://127.0.0.1:1234/v1`
- `http://[::1]:8000/v1`

Rejected examples:

- `https://example.com/v1`
- `http://192.168.1.25:11434`

## Browser Checklist

- Confirm the provider API works with `curl`.
- Confirm your app uses the right provider ID.
- Prefer `createLocalRelayProxyClient` for hosted browser apps.
- Use `--allowed-origin` for the exact app origin you want to allow.
- Show the normalized Local Relay error `suggestion` in setup screens where possible.
