# API Stability Notes

This maintainer note records the current `0.1.0` public surface and decisions to preserve before publishing or making breaking changes.

## Public Surface

- `createLocalRelayClient(options)`
- `createLocalRelayProxyClient(options)`
- Provider detection and model listing
- Non-streaming chat and streaming chat
- Embeddings
- OpenAI-compatible Responses API calls and response streaming
- Chat tool definitions, tool-call results, response format passthrough, and multimodal content parts
- Built-in provider IDs
- React hooks and lightweight components
- Proxy HTTP routes and request bodies

## Current Decisions

- Keep provider IDs as `ollama`, `ollama-openai`, `lmstudio`, and `openai-compatible`.
- Keep `timeoutMs` for detection and model listing.
- Keep `requestTimeoutMs` for chat and streaming defaults.
- Allow per-request `timeoutMs` on generation requests.
- Keep `chat()` requiring an explicit provider when multiple providers are configured.
- Keep `listModels()` returning an empty list for unavailable providers only when no specific provider/base URL was requested.
- Keep `raw` provider payloads on models, responses, usage, and stream events.
- Keep `rawOptions` on advanced requests for local-runtime-specific OpenAI-compatible extensions.
- Keep `baseUrl` request overrides, with proxy-side localhost validation.
- Keep React hooks client-injected rather than creating implicit clients inside hooks.
- Keep `createLocalRelayProxyClient` in `@local-relay/core` so browser apps can use the same `LocalRelayClient` interface through the optional localhost proxy.

## Browser Notes

- The default browser `fetch` must be bound to `globalThis`; Safari/WebKit throws when `Window.fetch` is called without its `Window` receiver.
- Ollama GET requests work better as simple browser requests without custom `Accept` headers.

## Future Review Areas

- Abort/cancel controls in React hooks.
- Higher-level automatic direct-to-proxy fallback examples.
- Provider capability inference beyond basic declared capabilities.
- Remote/LAN proxy mode, if the project chooses to support it later.
