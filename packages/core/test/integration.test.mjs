import assert from "node:assert/strict";
import test from "node:test";
import { createLocalRelayClient } from "../dist/index.js";

const shouldTestOllama = process.env.LOCAL_RELAY_TEST_OLLAMA === "1";
const shouldTestLmStudio = process.env.LOCAL_RELAY_TEST_LMSTUDIO === "1";

test("integration: Ollama lists local models", { skip: !shouldTestOllama }, async () => {
  const client = createLocalRelayClient({
    providers: ["ollama"],
    timeoutMs: 5000,
  });

  const providers = await client.detectProviders();
  assert.equal(providers[0]?.provider.status, "available");

  const models = await client.listModels({ provider: "ollama", timeoutMs: 5000 });
  assert.ok(Array.isArray(models));
});

test("integration: Ollama streams a response with first available model", { skip: !shouldTestOllama }, async () => {
  const client = createLocalRelayClient({
    providers: ["ollama"],
    timeoutMs: 10000,
  });
  const models = await client.listModels({ provider: "ollama", timeoutMs: 5000 });
  const model = models[0];

  assert.ok(model, "Expected at least one Ollama model to be installed.");

  let content = "";
  for await (const event of client.streamChat({
    provider: "ollama",
    model: model.id,
    messages: [{ role: "user", content: "Reply with the word local." }],
  })) {
    if (event.type === "token") {
      content += event.text;
    }
  }

  assert.ok(content.trim().length > 0);
});

test("integration: LM Studio lists local models", { skip: !shouldTestLmStudio }, async () => {
  const client = createLocalRelayClient({
    providers: ["lmstudio"],
    timeoutMs: 5000,
  });

  const providers = await client.detectProviders();
  assert.equal(providers[0]?.provider.status, "available");

  const models = await client.listModels({ provider: "lmstudio", timeoutMs: 5000 });
  assert.ok(Array.isArray(models));
});

test("integration: LM Studio streams a response with first available model", { skip: !shouldTestLmStudio }, async () => {
  const client = createLocalRelayClient({
    providers: ["lmstudio"],
    timeoutMs: 10000,
  });
  const models = await client.listModels({ provider: "lmstudio", timeoutMs: 5000 });
  const model = models[0];

  assert.ok(model, "Expected at least one LM Studio model to be available.");

  let content = "";
  for await (const event of client.streamChat({
    provider: "lmstudio",
    model: model.id,
    messages: [{ role: "user", content: "Reply with the word local." }],
  })) {
    if (event.type === "token") {
      content += event.text;
    }
  }

  assert.ok(content.trim().length > 0);
});
