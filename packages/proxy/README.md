# @local-relay/proxy

Optional localhost proxy for Local Relay browser integrations.

## Status

`0.1.0` alpha. The API is pre-1.0 and may change.

## Usage

```bash
npx @local-relay/proxy
```

Default URL:

```txt
http://127.0.0.1:44114
```

The proxy binds to `127.0.0.1` by default and rejects non-local provider URLs by default.

Use it from browser apps with `createLocalRelayProxyClient` from `@local-relay/core`. The proxy forwards model listing, chat, streaming chat, embeddings, Responses API calls, and streaming Responses API events.

See the repository README for provider, proxy, and browser limitation docs.
