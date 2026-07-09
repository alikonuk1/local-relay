# Security Notes

Local Relay is designed for local-first AI integrations. It should not turn a user's local LLM runtime into a public network service.

## Defaults

- No telemetry.
- No prompt logging.
- Known localhost provider URLs only.
- Proxy binds to `127.0.0.1` by default.
- Proxy rejects non-local provider URLs by default.
- Proxy has a request body limit.

## Proxy Binding

The proxy only binds to localhost by default.

Allowed:

- `127.0.0.1`
- `localhost`
- `::1`

Do not bind the proxy to `0.0.0.0` for normal use. Local Relay's alpha proxy intentionally supports localhost binding only.

## Provider URLs

The proxy rejects remote provider URLs by default. This prevents a browser app from using the proxy as a general network relay.

## Prompt Data

Local Relay passes prompts to the configured local provider. It does not store or transmit prompts elsewhere.

Application developers should still treat prompts and responses as sensitive application data.

## CORS

For development, the proxy allows any origin by default. For product use, configure allowed origins:

```bash
npx @local-relay/proxy --allowed-origin https://your-app.example
```

## Proxy Security Review

Reviewed for the `0.1.0` alpha candidate.

Current behavior:

- Default bind host is `127.0.0.1`.
- Bind hosts are restricted to `127.0.0.1`, `localhost`, and `::1`.
- Configured provider URLs are rejected unless their host is `localhost`, `127.0.0.1`, or `::1`.
- Per-request `baseUrl` overrides are validated with the same localhost-only rule.
- Request bodies are limited to 1 MB by default.
- The proxy does not log prompts or responses.
- Streaming forwards server-sent events and serializes stream errors without exposing stack traces.
- CORS defaults to any origin for local development, and can be narrowed with `--allowed-origin`.

Alpha risk accepted:

- `allowedOrigins` defaults to `["*"]` for local development ergonomics. Product integrations should set explicit origins.
- Provider allowlisting is hostname-based and intentionally limited to localhost names; it does not support private LAN hosts in alpha.

## Security Review Checklist

- Confirm proxy bind host is localhost. Done.
- Confirm non-local provider URLs are rejected. Done.
- Confirm prompts are not logged. Done.
- Confirm CORS origins are configured for the intended app. Required for product use; alpha default is permissive for local development.
- Confirm request body limits are appropriate for expected workloads. Done for alpha default of 1 MB.
- Confirm dependency audit passes. Done during dependency install: 0 vulnerabilities reported.
