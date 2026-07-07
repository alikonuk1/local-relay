export interface LocalRelayErrorDetails {
  code: string;
  provider?: string;
  baseUrl?: string;
  endpoint?: string;
  status?: number;
  cause?: unknown;
  suggestion?: string;
}

export class LocalRelayError extends Error {
  readonly code: string;
  readonly provider: string | undefined;
  readonly baseUrl: string | undefined;
  readonly endpoint: string | undefined;
  readonly status: number | undefined;
  readonly suggestion: string | undefined;

  constructor(message: string, details: LocalRelayErrorDetails) {
    super(message);
    this.name = new.target.name;
    this.code = details.code;
    this.provider = details.provider;
    this.baseUrl = details.baseUrl;
    this.endpoint = details.endpoint;
    this.status = details.status;
    this.suggestion = details.suggestion;

    if (details.cause !== undefined) {
      this.cause = details.cause;
    }
  }
}

export class ProviderUnavailableError extends LocalRelayError {
  constructor(message: string, details: Omit<LocalRelayErrorDetails, "code"> = {}) {
    super(message, { ...details, code: "provider_unavailable" });
  }
}

export class ProviderBlockedError extends LocalRelayError {
  constructor(message: string, details: Omit<LocalRelayErrorDetails, "code"> = {}) {
    super(message, { ...details, code: "provider_blocked" });
  }
}

export class ProviderCorsError extends LocalRelayError {
  constructor(message: string, details: Omit<LocalRelayErrorDetails, "code"> = {}) {
    super(message, { ...details, code: "provider_cors_error" });
  }
}

export class ProviderTimeoutError extends LocalRelayError {
  constructor(message: string, details: Omit<LocalRelayErrorDetails, "code"> = {}) {
    super(message, { ...details, code: "provider_timeout" });
  }
}

export class InvalidProviderResponseError extends LocalRelayError {
  constructor(message: string, details: Omit<LocalRelayErrorDetails, "code"> = {}) {
    super(message, { ...details, code: "invalid_provider_response" });
  }
}

export class ModelNotFoundError extends LocalRelayError {
  constructor(message: string, details: Omit<LocalRelayErrorDetails, "code"> = {}) {
    super(message, { ...details, code: "model_not_found" });
  }
}

export class UnsupportedCapabilityError extends LocalRelayError {
  constructor(message: string, details: Omit<LocalRelayErrorDetails, "code"> = {}) {
    super(message, { ...details, code: "unsupported_capability" });
  }
}

export function isLocalRelayError(error: unknown): error is LocalRelayError {
  return error instanceof LocalRelayError;
}
