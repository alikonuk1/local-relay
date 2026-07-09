# API Stability Notes

Local Relay is currently a `0.1.0` alpha. The API is usable, tested, and documented, but it should still be treated as pre-1.0 and open to breaking changes based on user feedback.

## Public Surface

- `createLocalRelayClient(options)`
- `createLocalRelayProxyClient(options)`
- Provider detection and model listing
- Non-streaming chat and streaming chat
- Embeddings
- OpenAI-compatible Responses API calls and response streaming
- Chat tool definitions, tool-call results, response format passthrough, and multimodal content parts
- Built-in provider ids
- React hooks and lightweight components
- Proxy HTTP routes and request bodies

## Current Decisions

- Keep provider ids as `ollama`, `ollama-openai`, `lmstudio`, and `openai-compatible`.
- Keep `timeoutMs` for detection and model listing, where short failures are useful.
- Keep `requestTimeoutMs` for chat and streaming defaults, because local model generation can take materially longer.
- Allow per-request `timeoutMs` on chat and streaming requests.
- Keep `chat()` requiring an explicit provider when multiple providers are configured.
- Keep `listModels()` returning an empty list for unavailable providers only when no specific provider/base URL was requested.
- Keep `raw` provider payloads on models, responses, usage, and stream events for alpha debugging and provider-specific inspection.
- Keep `rawOptions` on advanced requests for local-runtime-specific OpenAI-compatible extensions.
- Keep `baseUrl` request overrides, with proxy-side localhost validation.
- Keep React hooks client-injected rather than creating implicit clients inside hooks.
- Add `createLocalRelayProxyClient` to `@local-relay/core` so browser apps can use the same `LocalRelayClient` interface through the optional localhost proxy.
- Add advanced proxy routes for embeddings and Responses API forwarding so hosted browser apps can use the same feature set through the localhost companion process.

## Browser Notes

- The default browser `fetch` must be bound to `globalThis`; Safari/WebKit throws when `Window.fetch` is called without its `Window` receiver.
- Ollama GET requests work better as simple browser requests without custom `Accept` headers.
- The current API is coherent for alpha, but timeout naming should be treated as pre-1.0 and open to feedback.

## Not Included Yet

- Abort/cancel controls in React hooks.
- Higher-level automatic direct-to-proxy fallback.
- Provider capability inference beyond basic declared capabilities.
- Remote/LAN proxy mode.
