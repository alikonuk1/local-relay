# @local-relay/react

React hooks and lightweight UI primitives for Local Relay.

## Install

```bash
npm install @local-relay/core @local-relay/react
```

## Usage

```tsx
import { createLocalRelayClient } from "@local-relay/core";
import { ModelSelector, ProviderSelector, useLocalModels } from "@local-relay/react";

const client = createLocalRelayClient({ providers: ["ollama", "lmstudio"] });

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

Use `createLocalRelayProxyClient` from `@local-relay/core` with these hooks when your browser app talks through `@local-relay/proxy`.

## Exports

- `useProviderDetection`
- `useLocalModels`
- `useStreamingChat`
- `ProviderSelector`
- `ModelSelector`
- `ConnectionStatus`
- `LocalRelaySetupHint`

See the repository README for provider, proxy, browser, and security guides.
