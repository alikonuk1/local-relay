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

Do not bind the proxy to `0.0.0.0` for normal use. If a future release allows broader binding, it should require explicit opt-in and prominent warnings.

## Provider URLs

The proxy rejects remote provider URLs by default. This prevents a browser app from using the proxy as a general network relay.

## Prompt Data

Local Relay passes prompts to the configured local provider. It does not store or transmit prompts elsewhere.

Application developers should still treat prompts and responses as sensitive application data.

## CORS

For development, the proxy allows any origin by default. For product use, configure allowed origins:

```bash
local-relay-proxy --allowed-origin https://your-app.example
```

## Security Review Checklist

- Confirm proxy bind host is localhost.
- Confirm non-local provider URLs are rejected.
- Confirm prompts are not logged.
- Confirm CORS origins are configured for the intended app.
- Confirm request body limits are appropriate for expected workloads.
- Confirm dependency audit passes.
