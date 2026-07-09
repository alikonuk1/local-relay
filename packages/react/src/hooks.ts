import { useCallback, useMemo, useState } from "react";
import type {
  ChatMessage,
  ChatStreamEvent,
  DetectOptions,
  LocalRelayClient,
  LocalRelayModel,
  ProviderDetectionResult,
  ProviderId,
  ProviderRequestOptions,
} from "@local-relay/core";

export interface UseProviderDetectionResult {
  providers: ProviderDetectionResult[];
  isDetecting: boolean;
  error: Error | null;
  detect: (options?: DetectOptions) => Promise<ProviderDetectionResult[]>;
}

export function useProviderDetection(client: LocalRelayClient): UseProviderDetectionResult {
  const [providers, setProviders] = useState<ProviderDetectionResult[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const detect = useCallback(async (options?: DetectOptions) => {
    setIsDetecting(true);
    setError(null);

    try {
      const result = await client.detectProviders(options);
      setProviders(result);
      return result;
    } catch (caught) {
      const normalizedError = caught instanceof Error ? caught : new Error(String(caught));
      setError(normalizedError);
      throw normalizedError;
    } finally {
      setIsDetecting(false);
    }
  }, [client]);

  return { providers, isDetecting, error, detect };
}

export interface UseLocalModelsOptions {
  provider?: ProviderId;
  autoLoad?: boolean;
}

export interface UseLocalModelsResult {
  models: LocalRelayModel[];
  selectedModelId: string;
  isLoading: boolean;
  error: Error | null;
  loadModels: (requestOptions?: ProviderRequestOptions) => Promise<LocalRelayModel[]>;
  setSelectedModelId: (modelId: string) => void;
  selectedModel: LocalRelayModel | null;
}

export function useLocalModels(
  client: LocalRelayClient,
  options: UseLocalModelsOptions = {},
): UseLocalModelsResult {
  const [models, setModels] = useState<LocalRelayModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadModels = useCallback(async (requestOptions: ProviderRequestOptions = {}) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await client.listModels({
        ...requestOptions,
        ...(options.provider ? { provider: options.provider } : {}),
      });
      setModels(result);
      setSelectedModelId((current) => current || result[0]?.id || "");
      return result;
    } catch (caught) {
      const normalizedError = caught instanceof Error ? caught : new Error(String(caught));
      setError(normalizedError);
      throw normalizedError;
    } finally {
      setIsLoading(false);
    }
  }, [client, options.provider]);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? null,
    [models, selectedModelId],
  );

  return {
    models,
    selectedModelId,
    isLoading,
    error,
    loadModels,
    setSelectedModelId,
    selectedModel,
  };
}

export interface UseStreamingChatResult {
  content: string;
  events: ChatStreamEvent[];
  isStreaming: boolean;
  error: Error | null;
  send: (request: {
    provider?: ProviderId;
    model: string;
    messages: ChatMessage[];
  }) => Promise<string>;
  reset: () => void;
}

export function useStreamingChat(client: LocalRelayClient): UseStreamingChatResult {
  const [content, setContent] = useState("");
  const [events, setEvents] = useState<ChatStreamEvent[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const reset = useCallback(() => {
    setContent("");
    setEvents([]);
    setError(null);
  }, []);

  const send = useCallback(
    async (request: { provider?: ProviderId; model: string; messages: ChatMessage[] }) => {
      setContent("");
      setEvents([]);
      setError(null);
      setIsStreaming(true);

      let finalContent = "";

      try {
        for await (const event of client.streamChat(request)) {
          setEvents((current) => [...current, event]);

          if (event.type === "token") {
            finalContent += event.text;
            setContent(finalContent);
          }

          if (event.type === "message") {
            finalContent = event.content;
            setContent(event.content);
          }
        }

        return finalContent;
      } catch (caught) {
        const normalizedError = caught instanceof Error ? caught : new Error(String(caught));
        setError(normalizedError);
        throw normalizedError;
      } finally {
        setIsStreaming(false);
      }
    },
    [client],
  );

  return { content, events, isStreaming, error, send, reset };
}
