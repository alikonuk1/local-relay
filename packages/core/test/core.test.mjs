import assert from "node:assert/strict";
import test from "node:test";
import { createLocalRelayClient, createLocalRelayProxyClient } from "../dist/index.js";

test("lists models from an OpenAI-compatible provider", async () => {
  const calls = [];
  const client = createLocalRelayClient({
    providers: ["lmstudio"],
    fetch: async (url) => {
      calls.push(String(url));
      return jsonResponse({
        data: [{ id: "qwen2.5-7b-instruct" }],
      });
    },
  });

  const models = await client.listModels({ provider: "lmstudio" });

  assert.deepEqual(calls, ["http://localhost:1234/v1/models"]);
  assert.equal(models[0].id, "qwen2.5-7b-instruct");
  assert.equal(models[0].provider, "lmstudio");
});

test("sends non-streaming chat to an OpenAI-compatible provider", async () => {
  let requestBody;
  const client = createLocalRelayClient({
    providers: ["lmstudio"],
    fetch: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return jsonResponse({
        id: "chat-1",
        model: "local-model",
        choices: [{ message: { content: "hello" } }],
        usage: {
          prompt_tokens: 3,
          completion_tokens: 1,
          total_tokens: 4,
        },
      });
    },
  });

  const response = await client.chat({
    provider: "lmstudio",
    model: "local-model",
    messages: [{ role: "user", content: "hi" }],
  });

  assert.equal(requestBody.model, "local-model");
  assert.equal(requestBody.stream, false);
  assert.equal(response.content, "hello");
  assert.equal(response.usage.totalTokens, 4);
});

test("passes tools and multimodal content to OpenAI-compatible chat", async () => {
  let requestBody;
  const client = createLocalRelayClient({
    providers: ["lmstudio"],
    fetch: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return jsonResponse({
        model: "local-model",
        choices: [
          {
            message: {
              content: "",
              tool_calls: [
                {
                  id: "call_1",
                  type: "function",
                  function: { name: "lookup", arguments: "{\"q\":\"local\"}" },
                },
              ],
            },
            finish_reason: "tool_calls",
          },
        ],
      });
    },
  });

  const response = await client.chat({
    provider: "lmstudio",
    model: "local-model",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "describe this" },
          { type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
        ],
      },
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "lookup",
          parameters: { type: "object" },
        },
      },
    ],
    toolChoice: "auto",
    responseFormat: { type: "json_object" },
  });

  assert.equal(requestBody.tools[0].function.name, "lookup");
  assert.equal(requestBody.tool_choice, "auto");
  assert.equal(requestBody.response_format.type, "json_object");
  assert.equal(requestBody.messages[0].content[1].image_url.url, "data:image/png;base64,abc");
  assert.equal(response.toolCalls[0].function.name, "lookup");
  assert.equal(response.finishReason, "tool_calls");
});

test("streams chat tokens from an OpenAI-compatible provider", async () => {
  const client = createLocalRelayClient({
    providers: ["lmstudio"],
    fetch: async () =>
      streamResponse(
        [
          'data: {"choices":[{"delta":{"content":"hel"}}]}',
          "",
          'data: {"choices":[{"delta":{"content":"lo"}}]}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
        "text/event-stream",
      ),
  });

  const events = [];
  for await (const event of client.streamChat({
    provider: "lmstudio",
    model: "local-model",
    messages: [{ role: "user", content: "hi" }],
  })) {
    events.push(event);
  }

  assert.deepEqual(
    events.filter((event) => event.type === "token").map((event) => event.text),
    ["hel", "lo"],
  );
  assert.equal(events.find((event) => event.type === "message").content, "hello");
});

test("creates embeddings with an OpenAI-compatible provider", async () => {
  let urlSeen;
  let requestBody;
  const client = createLocalRelayClient({
    providers: ["lmstudio"],
    fetch: async (url, init) => {
      urlSeen = String(url);
      requestBody = JSON.parse(init.body);
      return jsonResponse({
        model: "embed-model",
        data: [{ object: "embedding", index: 0, embedding: [0.1, 0.2] }],
        usage: { prompt_tokens: 2, total_tokens: 2 },
      });
    },
  });

  const response = await client.embeddings({
    provider: "lmstudio",
    model: "embed-model",
    input: ["hello"],
    dimensions: 2,
    encodingFormat: "float",
  });

  assert.equal(urlSeen, "http://localhost:1234/v1/embeddings");
  assert.deepEqual(requestBody.input, ["hello"]);
  assert.equal(requestBody.dimensions, 2);
  assert.equal(requestBody.encoding_format, "float");
  assert.deepEqual(response.data[0].embedding, [0.1, 0.2]);
  assert.equal(response.usage.totalTokens, 2);
});

test("creates a response with an OpenAI-compatible provider", async () => {
  let urlSeen;
  let requestBody;
  const client = createLocalRelayClient({
    providers: ["openai-compatible"],
    fetch: async (url, init) => {
      urlSeen = String(url);
      requestBody = JSON.parse(init.body);
      return jsonResponse({
        id: "resp_1",
        model: "local-responses-model",
        output_text: "hello response",
        output: [{ id: "msg_1", type: "message", role: "assistant", content: [] }],
        usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 },
      });
    },
  });

  const response = await client.createResponse({
    provider: "openai-compatible",
    baseUrl: "http://localhost:8000/v1",
    model: "local-responses-model",
    input: "Say hello",
    instructions: "Be brief.",
    maxOutputTokens: 32,
    tools: [{ type: "function", name: "lookup" }],
    toolChoice: "auto",
  });

  assert.equal(urlSeen, "http://localhost:8000/v1/responses");
  assert.equal(requestBody.input, "Say hello");
  assert.equal(requestBody.instructions, "Be brief.");
  assert.equal(requestBody.max_output_tokens, 32);
  assert.equal(requestBody.tools[0].name, "lookup");
  assert.equal(response.outputText, "hello response");
  assert.equal(response.usage.completionTokens, 2);
});

test("streams response events from an OpenAI-compatible provider", async () => {
  const client = createLocalRelayClient({
    providers: [
      {
        id: "openai-compatible",
        baseUrl: "http://localhost:8000/v1",
      },
    ],
    fetch: async () =>
      streamResponse(
        [
          'data: {"type":"response.output_text.delta","delta":"hel"}',
          "",
          'data: {"type":"response.output_text.delta","delta":"lo"}',
          "",
          "data: [DONE]",
          "",
        ].join("\n"),
        "text/event-stream",
      ),
  });

  const events = [];
  for await (const event of client.streamResponse({
    provider: "openai-compatible",
    model: "local-responses-model",
    input: "Say hello",
  })) {
    events.push(event);
  }

  assert.deepEqual(
    events.filter((event) => event.type === "text-delta").map((event) => event.text),
    ["hel", "lo"],
  );
  assert.equal(events.at(-1).type, "done");
});

test("lists Ollama native models and loaded state", async () => {
  const client = createLocalRelayClient({
    providers: ["ollama"],
    fetch: async (url) => {
      if (String(url).endsWith("/api/tags")) {
        return jsonResponse({
          models: [
            {
              name: "llama3.2",
              model: "llama3.2",
              details: {
                family: "llama",
                parameter_size: "3.2B",
                quantization_level: "Q4_K_M",
              },
            },
          ],
        });
      }

      if (String(url).endsWith("/api/ps")) {
        return jsonResponse({
          models: [
            {
              name: "llama3.2",
              model: "llama3.2",
              context_length: 8192,
            },
          ],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    },
  });

  const models = await client.listModels({ provider: "ollama" });

  assert.equal(models[0].id, "llama3.2");
  assert.equal(models[0].family, "llama");
  assert.equal(models[0].parameterSize, "3.2B");
  assert.equal(models[0].quantization, "Q4_K_M");
  assert.equal(models[0].contextLength, 8192);
  assert.equal(models[0].loaded, true);
});

test("sends non-streaming chat to Ollama native API", async () => {
  let urlSeen;
  let requestBody;
  const client = createLocalRelayClient({
    providers: ["ollama"],
    fetch: async (url, init) => {
      urlSeen = String(url);
      requestBody = JSON.parse(init.body);
      return jsonResponse({
        model: "llama3.2",
        message: { role: "assistant", content: "native hello" },
        done: true,
        prompt_eval_count: 4,
        eval_count: 2,
      });
    },
  });

  const response = await client.chat({
    provider: "ollama",
    model: "llama3.2",
    messages: [{ role: "user", content: "hi" }],
    maxTokens: 10,
  });

  assert.equal(urlSeen, "http://localhost:11434/api/chat");
  assert.equal(requestBody.stream, false);
  assert.equal(requestBody.options.num_predict, 10);
  assert.equal(response.content, "native hello");
  assert.equal(response.usage.totalTokens, 6);
});

test("converts multimodal chat parts for Ollama native API", async () => {
  let requestBody;
  const client = createLocalRelayClient({
    providers: ["ollama"],
    fetch: async (_url, init) => {
      requestBody = JSON.parse(init.body);
      return jsonResponse({
        model: "llava",
        message: { role: "assistant", content: "image ok" },
        done: true,
      });
    },
  });

  await client.chat({
    provider: "ollama",
    model: "llava",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "What is this?" },
          { type: "image_url", image_url: "data:image/png;base64,abc123" },
        ],
      },
    ],
  });

  assert.equal(requestBody.messages[0].content, "What is this?");
  assert.deepEqual(requestBody.messages[0].images, ["abc123"]);
});

test("creates embeddings with Ollama native API", async () => {
  let urlSeen;
  let requestBody;
  const client = createLocalRelayClient({
    providers: ["ollama"],
    fetch: async (url, init) => {
      urlSeen = String(url);
      requestBody = JSON.parse(init.body);
      return jsonResponse({
        model: "nomic-embed-text",
        embeddings: [[0.3, 0.4]],
        prompt_eval_count: 2,
      });
    },
  });

  const response = await client.embeddings({
    provider: "ollama",
    model: "nomic-embed-text",
    input: "hello",
  });

  assert.equal(urlSeen, "http://localhost:11434/api/embed");
  assert.equal(requestBody.input, "hello");
  assert.deepEqual(response.data[0].embedding, [0.3, 0.4]);
  assert.equal(response.usage.promptTokens, 2);
});

test("uses a separate request timeout for chat", async () => {
  const client = createLocalRelayClient({
    providers: ["ollama"],
    timeoutMs: 1,
    requestTimeoutMs: 50,
    fetch: async (_url, init) => {
      await delay(10, init.signal);
      return jsonResponse({
        model: "llama3.2",
        message: { role: "assistant", content: "slow enough" },
        done: true,
      });
    },
  });

  const response = await client.chat({
    provider: "ollama",
    model: "llama3.2",
    messages: [{ role: "user", content: "hi" }],
  });

  assert.equal(response.content, "slow enough");
});

test("streams chat tokens from Ollama native API", async () => {
  const client = createLocalRelayClient({
    providers: ["ollama"],
    fetch: async () =>
      streamResponse(
        [
          '{"message":{"content":"nat"},"done":false}',
          '{"message":{"content":"ive"},"done":false}',
          '{"done":true,"prompt_eval_count":2,"eval_count":2}',
          "",
        ].join("\n"),
        "application/x-ndjson",
      ),
  });

  const events = [];
  for await (const event of client.streamChat({
    provider: "ollama",
    model: "llama3.2",
    messages: [{ role: "user", content: "hi" }],
  })) {
    events.push(event);
  }

  assert.deepEqual(
    events.filter((event) => event.type === "token").map((event) => event.text),
    ["nat", "ive"],
  );
  assert.equal(events.find((event) => event.type === "message").content, "native");
  assert.equal(events.find((event) => event.type === "usage").usage.totalTokens, 4);
});

test("proxy client detects providers through the local proxy", async () => {
  let urlSeen;
  const client = createLocalRelayProxyClient({
    baseUrl: "http://127.0.0.1:44114",
    fetch: async (url) => {
      urlSeen = String(url);
      return jsonResponse({
        providers: [
          {
            provider: {
              id: "ollama",
              name: "Ollama",
              baseUrl: "http://localhost:11434",
              status: "available",
              capabilities: ["chat", "chat-streaming", "model-list"],
            },
          },
        ],
      });
    },
  });

  const providers = await client.detectProviders();

  assert.equal(urlSeen, "http://127.0.0.1:44114/providers");
  assert.equal(providers[0].provider.id, "ollama");
  assert.equal(providers[0].provider.status, "available");
});

test("proxy client lists models for a provider", async () => {
  let urlSeen;
  const client = createLocalRelayProxyClient({
    fetch: async (url) => {
      urlSeen = String(url);
      return jsonResponse({
        models: [{ id: "llama3.2", name: "llama3.2", provider: "ollama" }],
      });
    },
  });

  const models = await client.listModels({ provider: "ollama" });

  assert.equal(urlSeen, "http://127.0.0.1:44114/providers/ollama/models");
  assert.equal(models[0].id, "llama3.2");
});

test("proxy client sends non-streaming chat through the local proxy", async () => {
  let urlSeen;
  let requestBody;
  const client = createLocalRelayProxyClient({
    fetch: async (url, init) => {
      urlSeen = String(url);
      requestBody = JSON.parse(init.body);
      return jsonResponse({
        response: {
          model: "llama3.2",
          provider: "ollama",
          content: "proxy hello",
        },
      });
    },
  });

  const response = await client.chat({
    provider: "ollama",
    model: "llama3.2",
    messages: [{ role: "user", content: "hi" }],
    timeoutMs: 60000,
  });

  assert.equal(urlSeen, "http://127.0.0.1:44114/providers/ollama/chat");
  assert.equal(requestBody.model, "llama3.2");
  assert.equal(requestBody.timeoutMs, 60000);
  assert.equal(response.content, "proxy hello");
});

test("proxy client sends embeddings through the local proxy", async () => {
  let urlSeen;
  let requestBody;
  const client = createLocalRelayProxyClient({
    fetch: async (url, init) => {
      urlSeen = String(url);
      requestBody = JSON.parse(init.body);
      return jsonResponse({
        response: {
          model: "embed-model",
          provider: "lmstudio",
          data: [{ index: 0, embedding: [0.1] }],
        },
      });
    },
  });

  const response = await client.embeddings({
    provider: "lmstudio",
    model: "embed-model",
    input: "hello",
  });

  assert.equal(urlSeen, "http://127.0.0.1:44114/providers/lmstudio/embeddings");
  assert.equal(requestBody.input, "hello");
  assert.deepEqual(response.data[0].embedding, [0.1]);
});

test("proxy client creates responses through the local proxy", async () => {
  let urlSeen;
  let requestBody;
  const client = createLocalRelayProxyClient({
    fetch: async (url, init) => {
      urlSeen = String(url);
      requestBody = JSON.parse(init.body);
      return jsonResponse({
        response: {
          model: "response-model",
          provider: "openai-compatible",
          output: [],
          outputText: "proxied",
        },
      });
    },
  });

  const response = await client.createResponse({
    provider: "openai-compatible",
    model: "response-model",
    input: "hi",
  });

  assert.equal(urlSeen, "http://127.0.0.1:44114/providers/openai-compatible/responses");
  assert.equal(requestBody.input, "hi");
  assert.equal(response.outputText, "proxied");
});

test("proxy client streams chat events from server-sent events", async () => {
  const client = createLocalRelayProxyClient({
    fetch: async () =>
      streamResponse(
        [
          'data: {"type":"start","provider":"ollama","model":"llama3.2"}',
          "",
          'data: {"type":"token","text":"hel"}',
          "",
          'data: {"type":"token","text":"lo"}',
          "",
          'data: {"type":"message","content":"hello"}',
          "",
          'data: {"type":"done"}',
          "",
        ].join("\n"),
        "text/event-stream",
      ),
  });

  const events = [];
  for await (const event of client.streamChat({
    provider: "ollama",
    model: "llama3.2",
    messages: [{ role: "user", content: "hi" }],
  })) {
    events.push(event);
  }

  assert.deepEqual(
    events.filter((event) => event.type === "token").map((event) => event.text),
    ["hel", "lo"],
  );
  assert.equal(events.find((event) => event.type === "message").content, "hello");
  assert.equal(events.at(-1).type, "done");
});

test("proxy client streams response events from server-sent events", async () => {
  const client = createLocalRelayProxyClient({
    fetch: async () =>
      streamResponse(
        [
          'data: {"type":"start","provider":"openai-compatible","model":"response-model"}',
          "",
          'data: {"type":"text-delta","text":"hi"}',
          "",
          'data: {"type":"done"}',
          "",
        ].join("\n"),
        "text/event-stream",
      ),
  });

  const events = [];
  for await (const event of client.streamResponse({
    provider: "openai-compatible",
    model: "response-model",
    input: "hi",
  })) {
    events.push(event);
  }

  assert.equal(events.find((event) => event.type === "text-delta").text, "hi");
  assert.equal(events.at(-1).type, "done");
});

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function streamResponse(body, contentType) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": contentType },
    },
  );
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timeout = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}
