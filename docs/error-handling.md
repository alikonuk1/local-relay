# Error Handling

Local Relay normalizes common local-provider failures into typed errors.

## Error Classes

- `ProviderUnavailableError`
- `ProviderBlockedError`
- `ProviderCorsError`
- `ProviderTimeoutError`
- `InvalidProviderResponseError`
- `ModelNotFoundError`
- `UnsupportedCapabilityError`
- `LocalRelayError`

## Example

```ts
import { createLocalRelayClient, isLocalRelayError } from "@local-relay/core";

const client = createLocalRelayClient();

try {
  const models = await client.listModels({ provider: "ollama" });
  console.log(models);
} catch (error) {
  if (isLocalRelayError(error)) {
    console.error(error.code, error.message, error.suggestion);
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

Use `suggestion` for user-facing recovery hints where available.

## UI Guidance

Good user-facing messages should explain:

- Which provider failed.
- Whether the provider is unavailable, blocked, timed out, or returned invalid data.
- What the user can do next.

Avoid exposing raw stack traces in product UI.
