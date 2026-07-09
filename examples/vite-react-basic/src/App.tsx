import { FormEvent, useMemo, useState } from "react";
import { createLocalRelayClient } from "@local-relay/core";
import type { ChatMessage, ProviderId } from "@local-relay/core";
import {
  ModelSelector,
  ProviderSelector,
  useLocalModels,
  useProviderDetection,
} from "@local-relay/react";

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function App() {
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState("http://localhost:11434");
  const client = useMemo(
    () =>
      createLocalRelayClient({
        timeoutMs: 30000,
        requestTimeoutMs: 60000,
        providers: [
          {
            id: "ollama",
            name: "Ollama",
            baseUrl: ollamaBaseUrl,
          },
          {
            id: "lmstudio",
            name: "LM Studio",
            baseUrl: "http://127.0.0.1:1234/v1",
          },
        ],
      }),
    [ollamaBaseUrl],
  );

  const detection = useProviderDetection(client);
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | "">("");
  const models = useLocalModels(
    client,
    selectedProvider ? { provider: selectedProvider } : {},
  );
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [diagnostics, setDiagnostics] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<Error | null>(null);

  const selectedDetection = detection.providers.find(
    (result) => result.provider.id === selectedProvider,
  );
  const currentError = detection.error || models.error || streamError || selectedDetection?.error;
  const selectedProviderStatus = selectedDetection?.provider.status ?? "unknown";
  const canSend =
    Boolean(selectedProvider) &&
    Boolean(models.selectedModelId) &&
    Boolean(prompt.trim()) &&
    !isStreaming;

  async function handleDetect() {
    const result = await detection.detect({ timeoutMs: 10000 });
    const firstAvailable = result.find((item) => item.provider.status === "available");

    if (firstAvailable) {
      setSelectedProvider(firstAvailable.provider.id);
    }
  }

  async function handleLoadModels() {
    await models.loadModels({ timeoutMs: 10000 });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = prompt.trim();

    if (!selectedProvider || !models.selectedModelId || !content) {
      return;
    }

    const userMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    const assistantMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
    };
    const nextMessages = [...messages, userMessage];
    const requestMessages: ChatMessage[] = nextMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setMessages([...nextMessages, assistantMessage]);
    setPrompt("");
    setStreamError(null);
    setIsStreaming(true);

    let streamedContent = "";

    try {
      for await (const event of client.streamChat({
        provider: selectedProvider,
        model: models.selectedModelId,
        messages: requestMessages,
      })) {
        if (event.type === "token") {
          streamedContent += event.text;
          updateMessageContent(assistantMessage.id, streamedContent);
        }

        if (event.type === "message") {
          streamedContent = event.content;
          updateMessageContent(assistantMessage.id, streamedContent);
        }
      }
    } catch (error) {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      setStreamError(normalizedError);
      updateMessageContent(
        assistantMessage.id,
        streamedContent || "The local model request failed. Check the setup panel for details.",
      );
    } finally {
      setIsStreaming(false);
    }
  }

  function startNewChat() {
    setMessages([]);
    setPrompt("");
    setDiagnostics("");
    setStreamError(null);
    setIsStreaming(false);
  }

  function updateMessageContent(messageId: string, content: string) {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId ? { ...message, content } : message,
      ),
    );
  }

  async function runDiagnostics() {
    const lines: string[] = [];
    const endpoints = ["/api/version", "/api/tags", "/api/ps"];

    for (const endpoint of endpoints) {
      const url = `${ollamaBaseUrl.replace(/\/+$/, "")}${endpoint}`;
      await recordDiagnostic(lines, `fetch ${endpoint}`, async () => {
        const response = await fetch(url);
        const text = await response.text();
        return `${response.status} ${response.statusText} ${text.length} bytes`;
      });
    }

    await recordDiagnostic(lines, "client.detectProviders", async () => {
      const result = await client.detectProviders({ timeoutMs: 10000 });
      return JSON.stringify(
        result.map((item) => ({
          id: item.provider.id,
          status: item.provider.status,
          error: item.error ? formatErrorDetails(item.error) : null,
        })),
      );
    });

    await recordDiagnostic(lines, "client.listModels", async () => {
      const result = await client.listModels({ provider: "ollama", timeoutMs: 10000 });
      return `${result.length} models`;
    });

    setDiagnostics(lines.join("\n"));
  }

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Local Relay controls">
        <div className="sidebar-top">
          <button className="icon-button" type="button" aria-label="Toggle sidebar">
            <span />
          </button>
          <button className="icon-button" type="button" aria-label="New chat" onClick={startNewChat}>
            +
          </button>
        </div>

        <button className="new-chat-button" type="button" onClick={startNewChat}>
          New chat
        </button>

        <div className="brand">
          <div className="brand-mark">LR</div>
          <span>Local Relay</span>
        </div>

        <section className="control-panel" aria-label="Provider setup">
          <div className="control-row">
            <label htmlFor="provider">Provider</label>
            <ProviderSelector
              providers={detection.providers}
              value={selectedProvider}
              onChange={setSelectedProvider}
              className="select"
            />
          </div>

          <div className="control-row">
            <label htmlFor="ollama-base-url">Ollama URL</label>
            <input
              id="ollama-base-url"
              className="text-input"
              value={ollamaBaseUrl}
              onChange={(event) => setOllamaBaseUrl(event.currentTarget.value)}
            />
          </div>

          <div className="button-grid">
            <button className="secondary-button" type="button" onClick={handleDetect}>
              {detection.isDetecting ? "Detecting" : "Detect"}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void handleLoadModels()}
              disabled={!selectedProvider || models.isLoading}
            >
              {models.isLoading ? "Loading" : "Models"}
            </button>
          </div>
        </section>

        <section className="model-panel" aria-label="Model selection">
          <div className="control-row">
            <label htmlFor="model">Model</label>
            <ModelSelector
              models={models.models}
              value={models.selectedModelId}
              onChange={models.setSelectedModelId}
              className="select"
            />
          </div>
        </section>

        {currentError && (
          <section className="error-panel" role="alert">
            <strong>{currentError.message}</strong>
            <pre>{formatErrorDetails(currentError)}</pre>
          </section>
        )}

        <details className="diagnostics-panel">
          <summary>Diagnostics</summary>
          <button className="secondary-button full-width" type="button" onClick={() => void runDiagnostics()}>
            Run diagnostics
          </button>
          {diagnostics && <pre>{diagnostics}</pre>}
        </details>
      </aside>

      <section className="chat-shell" aria-label="Chat">
        <header className="chat-header">
          <div className="model-title">
            <span>{models.selectedModel?.name ?? "Local Relay"}</span>
            <span className="chevron">⌄</span>
          </div>
          <div className="status-cluster">
            <span className="status-pill" data-status={selectedProviderStatus}>
              {formatStatus(selectedProviderStatus)}
            </span>
            {models.models.length > 0 && (
              <span className="model-count">{models.models.length} models</span>
            )}
          </div>
        </header>

        <div className="message-list">
          {messages.length === 0 && !isStreaming ? (
            <div className="empty-state">
              <div className="empty-logo">LR</div>
              <h2>What can I help you build locally?</h2>
              <div className="suggestions">
                <button type="button" onClick={() => setPrompt("Explain what Local Relay does in one paragraph.")}>
                  Explain Local Relay
                </button>
                <button type="button" onClick={() => setPrompt("Write a concise test prompt for a local model integration.")}>
                  Draft a test prompt
                </button>
                <button type="button" onClick={() => setPrompt("Summarize the privacy benefits of local inference.")}>
                  Local inference privacy
                </button>
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <article className={`message ${message.role}`} key={message.id}>
                  {message.role === "assistant" && <div className="assistant-mark">LR</div>}
                  <div className="message-body">
                    <p>
                      {message.content || (
                        <span className="typing-dots" aria-label="Streaming response">
                          <span />
                          <span />
                          <span />
                        </span>
                      )}
                    </p>
                  </div>
                </article>
              ))}
            </>
          )}
        </div>

        <form className="composer" onSubmit={handleSubmit}>
          <div className="composer-box">
            <textarea
              aria-label="Message"
              value={prompt}
              onChange={(event) => setPrompt(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={
                models.selectedModelId
                  ? "Message Local Relay"
                  : "Detect Ollama and choose a model first"
              }
              rows={1}
            />
            <button className="send-button" type="submit" disabled={!canSend} aria-label="Send message">
              ↑
            </button>
          </div>
          <p className="composer-note">Local Relay can make mistakes. Check important output.</p>
        </form>
      </section>
    </main>
  );
}

async function recordDiagnostic(
  lines: string[],
  label: string,
  operation: () => Promise<string>,
) {
  try {
    lines.push(`${label}: ok ${await operation()}`);
  } catch (error) {
    lines.push(`${label}: error ${formatCaughtError(error)}`);
  }
}

function formatStatus(status: string): string {
  if (status === "available") {
    return "Connected";
  }

  if (status === "unavailable") {
    return "Unavailable";
  }

  if (status === "blocked") {
    return "Blocked";
  }

  return "Not checked";
}

function formatCaughtError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  return `${error.name}: ${error.message} ${formatErrorDetails(error)}`;
}

function formatErrorDetails(error: Error): string {
  const details = error as Error & {
    code?: string;
    provider?: string;
    baseUrl?: string;
    endpoint?: string;
    status?: number;
    suggestion?: string;
    cause?: unknown;
  };
  const cause = details.cause instanceof Error
    ? {
        name: details.cause.name,
        message: details.cause.message,
      }
    : details.cause;

  return JSON.stringify(
    {
      code: details.code,
      provider: details.provider,
      baseUrl: details.baseUrl,
      endpoint: details.endpoint,
      status: details.status,
      suggestion: details.suggestion,
      cause,
    },
    null,
    2,
  );
}
