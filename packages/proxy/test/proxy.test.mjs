import assert from "node:assert/strict";
import test from "node:test";
import { createLocalRelayProxy } from "../dist/index.js";

test("responds to health checks", async () => {
  const proxy = await startProxy();

  try {
    const response = await fetch(`${proxyBaseUrl(proxy)}/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.service, "local-relay-proxy");
  } finally {
    await proxy.stop();
  }
});

test("detects providers through proxy", async () => {
  const proxy = await startProxy({
    client: createStubClient({
      detectProviders: async () => [
        {
          provider: {
            id: "ollama",
            name: "Ollama",
            baseUrl: "http://localhost:11434",
            status: "available",
            capabilities: ["chat"],
          },
        },
      ],
    }),
  });

  try {
    const response = await fetch(`${proxyBaseUrl(proxy)}/providers`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.providers[0].provider.id, "ollama");
    assert.equal(body.providers[0].provider.status, "available");
  } finally {
    await proxy.stop();
  }
});

test("lists models through proxy", async () => {
  let providerSeen;
  let baseUrlSeen;
  const proxy = await startProxy({
    client: createStubClient({
      listModels: async (options) => {
        providerSeen = options.provider;
        baseUrlSeen = options.baseUrl;
        return [{ id: "llama3.2", name: "llama3.2", provider: "ollama" }];
      },
    }),
  });

  try {
    const response = await fetch(
      `${proxyBaseUrl(proxy)}/providers/ollama/models?baseUrl=${encodeURIComponent("http://localhost:11434")}`,
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(providerSeen, "ollama");
    assert.equal(baseUrlSeen, "http://localhost:11434");
    assert.equal(body.models[0].id, "llama3.2");
  } finally {
    await proxy.stop();
  }
});

test("rejects non-local provider URLs in model list query", async () => {
  const proxy = await startProxy();

  try {
    const response = await fetch(
      `${proxyBaseUrl(proxy)}/providers/openai-compatible/models?baseUrl=${encodeURIComponent("https://example.com/v1")}`,
    );
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "unsafe_provider_url");
  } finally {
    await proxy.stop();
  }
});

test("forwards chat requests through proxy", async () => {
  let requestSeen;
  const proxy = await startProxy({
    client: createStubClient({
      chat: async (request) => {
        requestSeen = request;
        return {
          model: request.model,
          provider: request.provider,
          content: "hello",
        };
      },
    }),
  });

  try {
    const response = await fetch(`${proxyBaseUrl(proxy)}/providers/lmstudio/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "local-model",
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requestSeen.provider, "lmstudio");
    assert.equal(requestSeen.model, "local-model");
    assert.equal(body.response.content, "hello");
  } finally {
    await proxy.stop();
  }
});

test("forwards embedding requests through proxy", async () => {
  let requestSeen;
  const proxy = await startProxy({
    client: createStubClient({
      embeddings: async (request) => {
        requestSeen = request;
        return {
          model: request.model,
          provider: request.provider,
          data: [{ index: 0, embedding: [0.1, 0.2] }],
        };
      },
    }),
  });

  try {
    const response = await fetch(`${proxyBaseUrl(proxy)}/providers/lmstudio/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "embed-model",
        input: "hello",
        dimensions: 2,
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requestSeen.provider, "lmstudio");
    assert.equal(requestSeen.input, "hello");
    assert.equal(requestSeen.dimensions, 2);
    assert.deepEqual(body.response.data[0].embedding, [0.1, 0.2]);
  } finally {
    await proxy.stop();
  }
});

test("forwards Responses API requests through proxy", async () => {
  let requestSeen;
  const proxy = await startProxy({
    client: createStubClient({
      createResponse: async (request) => {
        requestSeen = request;
        return {
          model: request.model,
          provider: request.provider,
          output: [],
          outputText: "hello",
        };
      },
    }),
  });

  try {
    const response = await fetch(`${proxyBaseUrl(proxy)}/providers/openai-compatible/responses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "response-model",
        input: "hi",
        tools: [{ type: "function", name: "lookup" }],
        toolChoice: "auto",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(requestSeen.provider, "openai-compatible");
    assert.equal(requestSeen.input, "hi");
    assert.equal(requestSeen.tools[0].name, "lookup");
    assert.equal(body.response.outputText, "hello");
  } finally {
    await proxy.stop();
  }
});

test("streams chat requests as server-sent events", async () => {
  const proxy = await startProxy({
    client: createStubClient({
      streamChat: async function* () {
        yield { type: "start", provider: "ollama", model: "llama3.2" };
        yield { type: "token", text: "hel" };
        yield { type: "token", text: "lo" };
        yield { type: "done" };
      },
    }),
  });

  try {
    const response = await fetch(`${proxyBaseUrl(proxy)}/providers/ollama/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/event-stream/);
    assert.match(text, /"type":"token","text":"hel"/);
    assert.match(text, /"type":"done"/);
  } finally {
    await proxy.stop();
  }
});

test("streams Responses API requests as server-sent events", async () => {
  const proxy = await startProxy({
    client: createStubClient({
      streamResponse: async function* () {
        yield { type: "start", provider: "openai-compatible", model: "response-model" };
        yield { type: "text-delta", text: "hi" };
        yield { type: "done" };
      },
    }),
  });

  try {
    const response = await fetch(`${proxyBaseUrl(proxy)}/providers/openai-compatible/responses/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "response-model",
        input: "hi",
      }),
    });
    const text = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/event-stream/);
    assert.match(text, /"type":"text-delta","text":"hi"/);
    assert.match(text, /"type":"done"/);
  } finally {
    await proxy.stop();
  }
});

test("rejects oversized request bodies", async () => {
  const proxy = await startProxy({ maxBodyBytes: 12 });

  try {
    const response = await fetch(`${proxyBaseUrl(proxy)}/providers/ollama/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama3.2",
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 413);
    assert.equal(body.error.code, "request_too_large");
  } finally {
    await proxy.stop();
  }
});

test("rejects non-local provider URLs in request bodies", async () => {
  const proxy = await startProxy();

  try {
    const response = await fetch(`${proxyBaseUrl(proxy)}/providers/openai-compatible/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl: "https://example.com/v1",
        model: "remote-model",
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.error.code, "unsafe_provider_url");
  } finally {
    await proxy.stop();
  }
});

test("rejects non-local provider URLs in configuration", () => {
  assert.throws(
    () =>
      createLocalRelayProxy({
        providers: [
          {
            id: "openai-compatible",
            baseUrl: "https://example.com/v1",
          },
        ],
      }),
    /localhost provider URLs/,
  );
});

test("returns 405 for unsupported methods on known routes", async () => {
  const proxy = await startProxy();

  try {
    const response = await fetch(`${proxyBaseUrl(proxy)}/providers`, {
      method: "POST",
    });
    const body = await response.json();

    assert.equal(response.status, 405);
    assert.equal(body.error.code, "method_not_allowed");
  } finally {
    await proxy.stop();
  }
});

test("sets CORS headers for configured origins", async () => {
  const proxy = await startProxy({
    allowedOrigins: ["https://app.example"],
  });

  try {
    const response = await fetch(`${proxyBaseUrl(proxy)}/health`, {
      headers: { Origin: "https://app.example" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://app.example");
    assert.equal(response.headers.get("access-control-max-age"), "600");
  } finally {
    await proxy.stop();
  }
});

async function startProxy(options = {}) {
  const proxy = createLocalRelayProxy({
    port: 0,
    client: createStubClient(),
    ...options,
  });
  await proxy.start();
  return proxy;
}

function proxyBaseUrl(proxy) {
  const address = proxy.server.address();
  assert.equal(typeof address, "object");
  return `http://127.0.0.1:${address.port}`;
}

function createStubClient(overrides = {}) {
  return {
    detectProviders: async () => [],
    listModels: async () => [],
    chat: async (request) => ({
      model: request.model,
      provider: request.provider,
      content: "",
    }),
    streamChat: async function* () {
      yield { type: "done" };
    },
    embeddings: async (request) => ({
      model: request.model,
      provider: request.provider,
      data: [],
    }),
    createResponse: async (request) => ({
      model: request.model,
      provider: request.provider,
      output: [],
    }),
    streamResponse: async function* () {
      yield { type: "done" };
    },
    ...overrides,
  };
}
