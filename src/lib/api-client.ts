import { apiUrl, csrfCookieName } from "@/lib/env";

export interface ApiErrorPayload {
  error?: {
    code?: unknown;
    message?: unknown;
    requestId?: unknown;
  };
}

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

/**
 * Network failures have no HTTP status and should be handled differently from
 * a valid API rejection. Public read surfaces can use the local fixture
 * fallback for this class of failure; mutations must still surface an error.
 */
export function isGatewayOfflineError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (error instanceof ApiClientError) return false;
  if (error instanceof DOMException && error.name === "AbortError") return false;
  return error instanceof TypeError;
}

export interface ApiRequestOptions {
  idempotencyKey?: string;
  requestId?: string;
  timeoutMs?: number;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefix = `${encodeURIComponent(name)}=`;
  const value = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return value ? decodeURIComponent(value.slice(prefix.length)) : undefined;
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return typeof value === "object" && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `aevo-go-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function requestJson<T>(path: string, init: RequestInit = {}, options: ApiRequestOptions = {}): Promise<T> {
  const requestHeaders = new Headers(init.headers);
  requestHeaders.set("accept", "application/json");
  requestHeaders.set("x-request-id", options.requestId ?? requestId());
  if (options.idempotencyKey) requestHeaders.set("idempotency-key", options.idempotencyKey);
  if (!['GET', 'HEAD', 'OPTIONS'].includes((init.method ?? "GET").toUpperCase())) {
    const csrfToken = readCookie(csrfCookieName);
    if (csrfToken) requestHeaders.set("x-csrf-token", csrfToken);
  }
  if (init.body) requestHeaders.set("content-type", "application/json");

  const timeoutController = new AbortController();
  const abortFromCaller = () => timeoutController.abort();
  if (init.signal?.aborted) timeoutController.abort();
  else init.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeoutId = window.setTimeout(() => timeoutController.abort(), options.timeoutMs ?? 15_000);
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      ...init,
      credentials: "include",
      headers: requestHeaders,
      signal: timeoutController.signal
    });
  } finally {
    window.clearTimeout(timeoutId);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }

  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const errorPayload = isApiErrorPayload(payload) ? payload.error : undefined;
    throw new ApiClientError(
      response.status,
      readString(errorPayload?.code) ?? "REQUEST_FAILED",
      readString(errorPayload?.message) ?? "The request could not be completed.",
      readString(errorPayload?.requestId) ?? readString(response.headers.get("x-request-id"))
    );
  }

  return payload as T;
}
