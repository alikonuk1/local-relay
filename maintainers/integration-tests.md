# Integration Tests

Local Relay includes optional integration tests for real local providers. These tests are skipped by default because they require local runtimes to be installed, running, and configured with at least one model.

## Ollama

Requirements:

- Ollama is installed.
- Ollama is running.
- At least one model is installed.

Run:

```bash
LOCAL_RELAY_TEST_OLLAMA=1 npm test --workspace @local-relay/core
```

## LM Studio

Requirements:

- LM Studio is installed.
- The local server is running.
- At least one chat model is available from `GET /v1/models`.

Run:

```bash
LOCAL_RELAY_TEST_LMSTUDIO=1 npm test --workspace @local-relay/core
```

## Normal Test Run

Without environment variables, only mocked contract tests run:

```bash
npm test
```
