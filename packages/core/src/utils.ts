import { ProviderTimeoutError } from "./errors.js";

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

export function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = normalizeBaseUrl(baseUrl);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  externalSignal?: AbortSignal,
  timeoutDetails?: { provider?: string; baseUrl?: string; endpoint?: string },
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });

  try {
    return await operation(controller.signal);
  } catch (error) {
    if (isAbortError(error) && !externalSignal?.aborted) {
      throw new ProviderTimeoutError("Local provider request timed out.", {
        ...timeoutDetails,
        cause: error,
      });
    }

    throw error;
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

export function createUnavailableProvider(
  id: string,
  name: string,
  baseUrl: string,
  capabilities: string[],
) {
  return {
    id,
    name,
    baseUrl: normalizeBaseUrl(baseUrl),
    status: "unavailable" as const,
    capabilities,
  };
}
