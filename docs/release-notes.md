# Release Notes

## 0.1.0

Initial Local Relay release.

### Core

- Added `@local-relay/core`.
- Added provider detection and model listing.
- Added non-streaming chat and streaming chat.
- Added embeddings support.
- Added OpenAI-compatible Responses API helpers.
- Added normalized provider, model, message, response, stream, and error types.
- Added built-in providers for Ollama, Ollama OpenAI-compatible API, LM Studio, and generic OpenAI-compatible local endpoints.

### Browser And Proxy

- Added `@local-relay/proxy` as an optional localhost companion process for browser apps.
- Added `createLocalRelayProxyClient` to use the same Local Relay client shape through the proxy.
- Added proxy routes for provider detection, model listing, chat, streaming chat, embeddings, Responses API calls, and streaming Responses API events.
- Added localhost-only proxy defaults and local provider URL validation.

### React

- Added `@local-relay/react`.
- Added hooks for provider detection, model listing, and streaming chat.
- Added lightweight provider, model, connection, and setup components.

### Advanced Local Provider Features

- Added chat tool definition passthrough for OpenAI-compatible providers.
- Added tool-call normalization.
- Added response format passthrough.
- Added multimodal chat content parts.
- Added Ollama native image chat conversion.

### Example

- Added a Vite React example app with provider detection, model selection, direct/proxy mode, diagnostics, and incremental streaming transcript updates.

## Notes

Local Relay is pre-1.0. APIs are intended to be usable, but may change as local-provider behavior and integration needs become clearer.

Advanced feature support depends on the selected runtime and model. Local Relay forwards consistent request shapes, but a provider must implement the underlying capability.
