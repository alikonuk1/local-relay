# @local-relay/react

React hooks and lightweight UI primitives for Local Relay.

## Status

`0.1.0` alpha. The API is pre-1.0 and may change.

## Usage

```tsx
import { createLocalRelayClient } from "@local-relay/core";
import { ModelSelector, useLocalModels } from "@local-relay/react";

const client = createLocalRelayClient({ providers: ["ollama"] });

function LocalModelPicker() {
  const models = useLocalModels(client, { provider: "ollama" });

  return (
    <ModelSelector
      models={models.models}
      value={models.selectedModelId}
      onChange={models.setSelectedModelId}
    />
  );
}
```

Use `createLocalRelayProxyClient` from `@local-relay/core` with these hooks when your browser app talks through the Local Relay proxy.

See the repository README for provider, proxy, and browser limitation docs.
