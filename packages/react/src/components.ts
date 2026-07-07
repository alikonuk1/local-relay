import { createElement } from "react";
import type { LocalRelayModel, ProviderDetectionResult, ProviderId } from "@local-relay/core";

export interface ConnectionStatusProps {
  provider?: ProviderDetectionResult | undefined;
  className?: string;
}

export function ConnectionStatus({ provider, className }: ConnectionStatusProps) {
  const status = provider?.provider.status ?? "unknown";
  const label =
    status === "available"
      ? "Connected"
      : status === "unavailable"
        ? "Unavailable"
        : status === "blocked"
          ? "Blocked"
          : "Unknown";

  return createElement(
    "span",
    {
      className,
      "data-local-relay-status": status,
    },
    label,
  );
}

export interface ProviderSelectorProps {
  providers: ProviderDetectionResult[];
  value: ProviderId | "";
  onChange: (providerId: ProviderId) => void;
  className?: string;
}

export function ProviderSelector({ providers, value, onChange, className }: ProviderSelectorProps) {
  return createElement(
    "select",
    {
      className,
      value,
      onChange: (event) => onChange((event.currentTarget as HTMLSelectElement).value),
    },
    [
      createElement("option", { key: "", value: "" }, "Select provider"),
      ...providers.map((result) =>
        createElement(
          "option",
          {
            key: `${result.provider.id}:${result.provider.baseUrl}`,
            value: result.provider.id,
          },
          `${result.provider.name} (${result.provider.status})`,
        ),
      ),
    ],
  );
}

export interface ModelSelectorProps {
  models: LocalRelayModel[];
  value: string;
  onChange: (modelId: string) => void;
  className?: string;
}

export function ModelSelector({ models, value, onChange, className }: ModelSelectorProps) {
  return createElement(
    "select",
    {
      className,
      value,
      onChange: (event) => onChange((event.currentTarget as HTMLSelectElement).value),
    },
    [
      createElement("option", { key: "", value: "" }, "Select model"),
      ...models.map((model) =>
        createElement(
          "option",
          {
            key: `${model.provider}:${model.id}`,
            value: model.id,
          },
          model.loaded ? `${model.name} (loaded)` : model.name,
        ),
      ),
    ],
  );
}

export interface LocalRelaySetupHintProps {
  provider?: ProviderId | undefined;
  className?: string;
}

export function LocalRelaySetupHint({ provider, className }: LocalRelaySetupHintProps) {
  const text =
    provider === "lmstudio"
      ? "Start the LM Studio local server from the Developer tab."
      : provider === "ollama"
        ? "Start Ollama and make sure the local API is available."
        : "Start a local OpenAI-compatible server and provide its base URL.";

  return createElement("p", { className }, text);
}
