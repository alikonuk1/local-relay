# Error Handling

Local Relay turns common local-provider failures into typed errors with useful metadata for setup screens and product UI.

## Error Classes

- `ProviderUnavailableError`: the provider could not be reached or returned an unavailable response.
- `ProviderBlockedError`: the request was blocked by policy.
- `ProviderCorsError`: the browser or runtime reported a CORS-like network failure.
- `ProviderTimeoutError`: the request exceeded the configured timeout.
- `InvalidProviderResponseError`: the provider returned data Local Relay could not parse.
- `ModelNotFoundError`: the requested model was not available.
- `UnsupportedCapabilityError`: the selected provider does not support the requested Local Relay method.
- `LocalRelayError`: base error class for Local Relay failures.

## Catching Errors

```ts
import { createLocalRelayClient, isLocalRelayError } from "@local-relay/core";

const client = createLocalRelayClient({ providers: ["ollama"] });

try {
  const models = await client.listModels({ provider: "ollama" });
  console.log(models);
} catch (error) {
  if (isLocalRelayError(error)) {
    showSetupMessage({
      title: error.message,
      suggestion: error.suggestion,
      provider: error.provider,
    });
  } else {
    throw error;
  }
}
```

## Error Metadata

Local Relay errors can include:

- `code`
- `provider`
- `baseUrl`
- `endpoint`
- `status`
- `suggestion`
- `cause`

Use `suggestion` for user-facing recovery hints when it is available.

## Proxy Errors

Proxy-client errors use `LocalRelayError` with proxy-specific codes such as:

- `proxy_timeout`
- `proxy_request_failed`
- `proxy_error`
- `proxy_invalid_response`

These usually mean the browser app could reach the Local Relay proxy, but the proxy could not complete the provider request.

## UI Guidance

Good user-facing messages should explain:

- Which provider failed.
- Whether the provider is unavailable, blocked, timed out, or returned invalid data.
- What the user can do next.

Avoid showing raw stack traces or low-level network details in product UI. Keep those details in diagnostics panels or logs intended for developers.
