import { createOpenAICompatibleAdapter } from "./adapters/openai-compatible.js";
import { createOllamaNativeAdapter } from "./adapters/ollama-native.js";
import { ProviderUnavailableError } from "./errors.js";
import type {
  BuiltInProviderId,
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
  ChatStreamRequest,
  CreateLocalRelayClientOptions,
  LocalRelayClient,
  LocalRelayModel,
  LocalRelayProvider,
  ProviderAdapter,
  ProviderConfig,
  ProviderDetectionResult,
  ProviderId,
  ProviderRequestOptions,
} from "./types.js";
import { normalizeBaseUrl } from "./utils.js";

const DEFAULT_TIMEOUT_MS = 1500;
const DEFAULT_REQUEST_TIMEOUT_MS = 60000;

const BUILT_IN_ADAPTERS: Record<BuiltInProviderId, ProviderAdapter> = {
  ollama: createOllamaNativeAdapter(),
  "ollama-openai": createOpenAICompatibleAdapter({
    id: "ollama-openai",
    name: "Ollama OpenAI-compatible",
    defaultBaseUrls: ["http://localhost:11434/v1"],
  }),
  lmstudio: createOpenAICompatibleAdapter({
    id: "lmstudio",
    name: "LM Studio",
    defaultBaseUrls: ["http://localhost:1234/v1"],
  }),
  "openai-compatible": createOpenAICompatibleAdapter({
    id: "openai-compatible",
    name: "OpenAI-compatible",
    defaultBaseUrls: [],
  }),
};

export function createLocalRelayClient(
  options: CreateLocalRelayClientOptions = {},
): LocalRelayClient {
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    throw new Error("Local Relay requires a fetch implementation.");
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const requestTimeoutMs = options.requestTimeoutMs ?? options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const registrations = createProviderRegistrations(options.providers);

  return {
    async detectProviders(detectOptions = {}) {
      return Promise.all(
        registrations.map(({ adapter, provider }) =>
          adapter.detect({
            provider,
            fetch: fetchImpl,
            timeoutMs: detectOptions.timeoutMs ?? timeoutMs,
            ...(detectOptions.signal ? { signal: detectOptions.signal } : {}),
          }),
        ),
      );
    },

    async listModels(requestOptions = {}) {
      const targets = resolveTargets(registrations, requestOptions);
      const results = await Promise.all(
        targets.map(async ({ adapter, provider }) => {
          try {
            return await adapter.listModels({
              provider,
              fetch: fetchImpl,
              timeoutMs: requestOptions.timeoutMs ?? timeoutMs,
              ...(requestOptions.signal ? { signal: requestOptions.signal } : {}),
            });
          } catch (error) {
            if (requestOptions.provider || requestOptions.baseUrl) {
              throw error;
            }

            return [] satisfies LocalRelayModel[];
          }
        }),
      );

      return results.flat();
    },

    chat(request) {
      const target = resolveTarget(registrations, request);
      return target.adapter.chat({
        provider: target.provider,
        request,
        fetch: fetchImpl,
        timeoutMs: request.timeoutMs ?? requestTimeoutMs,
        ...(request.signal ? { signal: request.signal } : {}),
      });
    },

    streamChat(request) {
      const target = resolveTarget(registrations, request);
      return target.adapter.streamChat({
        provider: target.provider,
        request,
        fetch: fetchImpl,
        timeoutMs: request.timeoutMs ?? requestTimeoutMs,
        ...(request.signal ? { signal: request.signal } : {}),
      });
    },
  };
}

interface ProviderRegistration {
  adapter: ProviderAdapter;
  provider: LocalRelayProvider;
}

function createProviderRegistrations(
  providers: CreateLocalRelayClientOptions["providers"] = ["ollama", "lmstudio"],
): ProviderRegistration[] {
  const registrations: ProviderRegistration[] = [];

  for (const provider of providers) {
    if (typeof provider === "string") {
      const adapter = BUILT_IN_ADAPTERS[provider];
      for (const baseUrl of adapter.defaultBaseUrls) {
        registrations.push({
          adapter,
          provider: {
            id: adapter.id,
            name: adapter.name,
            baseUrl,
            status: "unknown",
            capabilities: adapter.capabilities,
          },
        });
      }
      continue;
    }

    registrations.push(createCustomRegistration(provider));
  }

  return registrations;
}

function createCustomRegistration(config: ProviderConfig): ProviderRegistration {
  const adapter =
    config.adapter ??
    (isBuiltInProviderId(config.id)
      ? BUILT_IN_ADAPTERS[config.id]
      : createOpenAICompatibleAdapter({
          id: config.id,
          name: config.name ?? String(config.id),
          defaultBaseUrls: config.baseUrl ? [config.baseUrl] : [],
          ...(config.capabilities ? { capabilities: config.capabilities } : {}),
        }));

  const baseUrl = config.baseUrl ?? adapter.defaultBaseUrls[0];
  if (!baseUrl) {
    throw new ProviderUnavailableError("Provider config requires a baseUrl.", {
      provider: config.id,
      suggestion: "Pass a localhost OpenAI-compatible base URL, for example http://localhost:1234/v1.",
    });
  }

  return {
    adapter,
    provider: {
      id: config.id,
      name: config.name ?? adapter.name,
      baseUrl: normalizeBaseUrl(baseUrl),
      status: "unknown",
      capabilities: config.capabilities ?? adapter.capabilities,
    },
  };
}

function resolveTargets(
  registrations: ProviderRegistration[],
  options: ProviderRequestOptions,
): ProviderRegistration[] {
  if (options.baseUrl) {
    const provider = options.provider ?? "openai-compatible";
    return [
      createCustomRegistration({
        id: provider,
        baseUrl: options.baseUrl,
      }),
    ];
  }

  if (options.provider) {
    return [resolveProvider(registrations, options.provider)];
  }

  return registrations;
}

function resolveTarget(
  registrations: ProviderRegistration[],
  request: ChatRequest | ChatStreamRequest,
): ProviderRegistration {
  if (request.baseUrl) {
    return createCustomRegistration({
      id: request.provider ?? "openai-compatible",
      baseUrl: request.baseUrl,
    });
  }

  if (request.provider) {
    return resolveProvider(registrations, request.provider);
  }

  if (registrations.length === 1) {
    const registration = registrations[0];
    if (registration) {
      return registration;
    }
  }

  throw new ProviderUnavailableError("A provider is required when multiple providers are configured.", {
    suggestion: "Pass provider: 'ollama', provider: 'lmstudio', or a custom baseUrl.",
  });
}

function resolveProvider(
  registrations: ProviderRegistration[],
  providerId: ProviderId,
): ProviderRegistration {
  const registration = registrations.find((item) => item.provider.id === providerId);
  if (!registration) {
    throw new ProviderUnavailableError(`Provider '${providerId}' is not configured.`, {
      provider: providerId,
    });
  }

  return registration;
}

function isBuiltInProviderId(id: ProviderId): id is BuiltInProviderId {
  return id === "ollama" || id === "ollama-openai" || id === "lmstudio" || id === "openai-compatible";
}
