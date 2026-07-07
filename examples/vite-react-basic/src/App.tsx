import { FormEvent, useMemo, useState } from "react";
import { createLocalRelayClient } from "@local-relay/core";
import type { ProviderId } from "@local-relay/core";
import {
  ConnectionStatus,
  LocalRelaySetupHint,
  ModelSelector,
  ProviderSelector,
  useLocalModels,
  useProviderDetection,
  useStreamingChat,
} from "@local-relay/react";

export function App() {
  const client = useMemo(() => createLocalRelayClient(), []);
  const detection = useProviderDetection(client);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | "">("");
  const models = useLocalModels(
    client,
    selectedProvider ? { provider: selectedProvider } : {},
  );
  const chat = useStreamingChat(client);
  const [prompt, setPrompt] = useState("Explain what Local Relay does in one paragraph.");

  const selectedDetection = detection.providers.find(
    (result) => result.provider.id === selectedProvider,
  );

  async function handleDetect() {
    const result = await detection.detect();
    const firstAvailable = result.find((item) => item.provider.status === "available");
    if (firstAvailable) {
      setSelectedProvider(firstAvailable.provider.id);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProvider || !models.selectedModelId || !prompt.trim()) {
      return;
    }

    await chat.send({
      provider: selectedProvider,
      model: models.selectedModelId,
      messages: [{ role: "user", content: prompt.trim() }],
    });
  }

  return (
    <main className="app-shell">
      <section className="toolbar" aria-label="Local model controls">
        <div className="control-group">
          <label htmlFor="provider">Provider</label>
          <ProviderSelector
            providers={detection.providers}
            value={selectedProvider}
            onChange={setSelectedProvider}
            className="select"
          />
        </div>

        <ConnectionStatus provider={selectedDetection} className="status-pill" />

        <button className="button" type="button" onClick={handleDetect}>
          {detection.isDetecting ? "Detecting..." : "Detect providers"}
        </button>

        <button
          className="button secondary"
          type="button"
          onClick={models.loadModels}
          disabled={!selectedProvider || models.isLoading}
        >
          {models.isLoading ? "Loading..." : "Load models"}
        </button>
      </section>

      <section className="workspace">
        <aside className="side-panel">
          <div className="control-group">
            <label htmlFor="model">Model</label>
            <ModelSelector
              models={models.models}
              value={models.selectedModelId}
              onChange={models.setSelectedModelId}
              className="select"
            />
          </div>

          <LocalRelaySetupHint
            provider={selectedProvider || undefined}
            className="setup-hint"
          />

          {(detection.error || models.error || chat.error) && (
            <div className="error-box" role="alert">
              {(detection.error || models.error || chat.error)?.message}
            </div>
          )}
        </aside>

        <form className="chat-panel" onSubmit={handleSubmit}>
          <label htmlFor="prompt">Prompt</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.currentTarget.value)}
            className="prompt-input"
          />

          <div className="actions">
            <button
              className="button"
              type="submit"
              disabled={!selectedProvider || !models.selectedModelId || chat.isStreaming}
            >
              {chat.isStreaming ? "Streaming..." : "Send"}
            </button>
            <button className="button secondary" type="button" onClick={chat.reset}>
              Clear
            </button>
          </div>

          <output className="response-output" aria-live="polite">
            {chat.content || "Response output will appear here."}
          </output>
        </form>
      </section>
    </main>
  );
}
