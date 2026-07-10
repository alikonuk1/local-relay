# Security

Local Relay is designed for local-first AI integrations. It should help a user's browser or app talk to local LLM runtimes without turning those runtimes into public network services.

## Data Flow

Local Relay sends prompts, messages, embeddings input, and response requests only to the provider you configure.

It does not:

- Send telemetry.
- Log prompts or responses.
- Store conversation data.
- Contact hosted model APIs by default.

Your application is still responsible for treating prompts and model output as sensitive user data.

## Direct Client

`createLocalRelayClient` calls the configured provider URL directly from the current runtime.

In a browser, that means the provider must allow your app's origin. If direct browser calls fail because of CORS or browser policy, use the proxy client instead.

## Proxy Client

The proxy is a local companion process for browser apps.

Default behavior:

- Binds to `127.0.0.1`.
- Rejects non-local provider URLs.
- Limits request bodies.
- Does not log prompts or responses.
- Supports explicit CORS origins.

Start the proxy with an allowed origin for product integrations:

```bash
npx @local-relay/proxy --allowed-origin https://your-app.example
```

For local apps:

```bash
npx @local-relay/proxy --allowed-origin http://localhost:5173
```

## Provider URLs

Keep provider URLs local unless you intentionally build a custom adapter for another trust boundary.

Allowed by the proxy by default:

- `http://localhost:11434`
- `http://127.0.0.1:1234/v1`
- `http://[::1]:8000/v1`

Rejected by the proxy by default:

- `https://example.com/v1`
- `http://192.168.1.25:11434`

## Recommended Product Defaults

- Ask the user before connecting to a local provider.
- Show the provider name and base URL in setup UI.
- Use explicit `--allowed-origin` values for proxy installations.
- Do not display raw stack traces to end users.
- Surface Local Relay error suggestions in setup or troubleshooting screens.
- Treat prompts, tool results, files, and model responses as private user data.

## What Local Relay Does Not Do

Local Relay does not install models, manage provider permissions, expose a remote tunnel, or make browser-blocked direct requests succeed automatically. Use the proxy for browser apps that need a reliable localhost integration path.
