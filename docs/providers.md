# Provider Guides

Local Relay currently supports Ollama, Ollama's OpenAI-compatible API, LM Studio, and generic OpenAI-compatible local endpoints.

## Ollama Native

Provider id:

```txt
ollama
```

Default base URL:

```txt
http://localhost:11434
```

Used endpoints:

- `GET /api/version`
- `GET /api/tags`
- `GET /api/ps`
- `POST /api/chat`

Use this provider when you want Ollama-specific metadata such as loaded model state, family, parameter size, and quantization where available.

```ts
const client = createLocalRelayClient({
  providers: ["ollama"],
});
```

## Ollama OpenAI-Compatible

Provider id:

```txt
ollama-openai
```

Default base URL:

```txt
http://localhost:11434/v1
```

Used endpoints:

- `GET /v1/models`
- `POST /v1/chat/completions`

Use this provider when you want Ollama to behave like a generic OpenAI-compatible endpoint.

## LM Studio

Provider id:

```txt
lmstudio
```

Default base URL:

```txt
http://localhost:1234/v1
```

Used endpoints:

- `GET /v1/models`
- `POST /v1/chat/completions`

LM Studio's local server must be running before Local Relay can connect.

## Generic OpenAI-Compatible

Provider id:

```txt
openai-compatible
```

Use this for local servers such as vLLM, llama.cpp server, LocalAI, or any runtime that implements enough of the OpenAI-compatible API.

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

## Provider Selection Guidance

- Prefer `ollama` for Ollama-specific local apps.
- Prefer `lmstudio` for LM Studio's local server.
- Prefer `openai-compatible` for custom local runtimes.
- Use `ollama-openai` when you specifically want Ollama through `/v1`.

## Timeouts

Provider detection and model listing use short timeouts by default so unavailable local servers fail quickly. Chat and streaming requests use longer defaults because local model generation can take longer, especially on first load.

```ts
const client = createLocalRelayClient({
  providers: ["ollama"],
  timeoutMs: 3000,
  requestTimeoutMs: 120000,
});
```
