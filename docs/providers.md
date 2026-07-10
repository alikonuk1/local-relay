# Provider Guides

Local Relay supports Ollama, LM Studio, and OpenAI-compatible local servers through built-in provider IDs.

## Ollama

Provider ID:

```txt
ollama
```

Default base URL:

```txt
http://localhost:11434
```

Use this provider for Ollama's native API. It can expose Ollama-specific model metadata such as family, parameter size, quantization, and loaded-model state when Ollama returns that data.

```ts
import { createLocalRelayClient } from "@local-relay/core";

const client = createLocalRelayClient({
  providers: ["ollama"],
});

const models = await client.listModels({ provider: "ollama" });
```

Supported Local Relay methods:

- `detectProviders`
- `listModels`
- `chat`
- `streamChat`
- `embeddings`

Ollama image chat parts are converted to Ollama's native message image format.

## Ollama OpenAI-Compatible

Provider ID:

```txt
ollama-openai
```

Default base URL:

```txt
http://localhost:11434/v1
```

Use this provider when you want Ollama through an OpenAI-compatible `/v1` API shape.

```ts
const client = createLocalRelayClient({
  providers: ["ollama-openai"],
});
```

## LM Studio

Provider ID:

```txt
lmstudio
```

Default base URL:

```txt
http://localhost:1234/v1
```

Before connecting:

1. Open LM Studio.
2. Start the local server from the Developer area.
3. Load a model that supports the API you want to call.

```ts
const client = createLocalRelayClient({
  providers: ["lmstudio"],
});

const models = await client.listModels({ provider: "lmstudio" });
```

If `/v1/models` only shows an embedding model, chat requests will fail until a chat model is loaded.

## Generic OpenAI-Compatible

Provider ID:

```txt
openai-compatible
```

Use this for local runtimes such as vLLM, llama.cpp server, LocalAI, Jan, or another local server that implements an OpenAI-compatible API.

```ts
const client = createLocalRelayClient({
  providers: [
    {
      id: "openai-compatible",
      name: "Local vLLM",
      baseUrl: "http://localhost:8000/v1",
    },
  ],
});
```

OpenAI-compatible providers can receive chat tools, multimodal chat parts, embeddings requests, and Responses API requests. Support depends on the runtime and model.

## Choosing A Provider

- Use `ollama` for Ollama-native integrations.
- Use `ollama-openai` when you specifically want Ollama through `/v1`.
- Use `lmstudio` for LM Studio's local server.
- Use `openai-compatible` for custom local runtimes.

## Timeouts

Detection and model listing are short by default. Generation requests are longer by default.

```ts
const client = createLocalRelayClient({
  providers: ["ollama"],
  timeoutMs: 3000,
  requestTimeoutMs: 120000,
});
```

You can also set `timeoutMs` on individual chat, streaming, embedding, or response requests.
