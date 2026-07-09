# Release Notes

## 0.1.0 Alpha Candidate

- Added `@local-relay/core` with provider detection, model listing, chat, streaming chat, normalized types, and normalized errors.
- Added Ollama native, Ollama OpenAI-compatible, LM Studio, and generic OpenAI-compatible providers.
- Added `@local-relay/react` hooks and lightweight components.
- Added `@local-relay/proxy` with localhost-only default binding, localhost provider URL validation, CORS handling, request body limits, and SSE forwarding.
- Added `createLocalRelayProxyClient` so browser apps can use the same client API through the optional localhost proxy.
- Added a Vite React example with a ChatGPT-style local chat UI and incremental streaming transcript updates.
- Added separate request timeout handling for chat/streaming via `requestTimeoutMs` and per-request `timeoutMs`.
- Fixed Safari/WebKit browser support by binding the default `fetch` implementation.
- Added package metadata, MIT license files, package READMEs, and public npm publish config.
- Validated real Ollama integration on this machine with model listing, chat, streaming, proxy forwarding, and browser example testing.

## Known Alpha Limits

- LM Studio real-provider validation still needs a machine with the LM Studio server running.
- Direct browser-to-provider support still depends on provider CORS and browser policy.
- Proxy is localhost-only by default and is not a remote gateway.
- Post-MVP APIs such as embeddings, Responses API, tool calling, and multimodal helpers are not implemented.
