import assert from "node:assert/strict";
import test from "node:test";
import { createLocalRelayClient } from "../dist/index.js";

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
