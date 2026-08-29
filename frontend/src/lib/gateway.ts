export function gatewayOrigin(): string {
  const value = import.meta.env.VITE_GATEWAY_URL;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("VITE_GATEWAY_URL is not set");
  }
  return value.replace(/\/+$/, "");
}

export function googleSignInUrl(next?: string): string {
  const url = new URL("/auth/google", `${gatewayOrigin()}/`);
  if (next) {
    url.searchParams.set("next", next);
  }
  return url.toString();
}

export function logoutUrl(next?: string): string {
  const url = new URL("/auth/logout", `${gatewayOrigin()}/`);
  if (next) {
    url.searchParams.set("next", next);
  }
  return url.toString();
}

export function chatSessionStorageKey(): string {
  const value = import.meta.env.VITE_CHAT_SESSION_STORAGE_KEY;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("VITE_CHAT_SESSION_STORAGE_KEY is not set");
  }
  return value;
}

export function readStoredChatSessionId(userId: string): string | null {
  return window.localStorage.getItem(`${chatSessionStorageKey()}:${userId}`);
}

export function writeStoredChatSessionId(userId: string, sessionId: string): void {
  window.localStorage.setItem(`${chatSessionStorageKey()}:${userId}`, sessionId);
}

export function clearStoredChatSessionId(userId: string): void {
  window.localStorage.removeItem(`${chatSessionStorageKey()}:${userId}`);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`${gatewayOrigin()}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  if (response.status === 204) {
    return undefined as T;
  }
  const body = (await response.json().catch(() => null)) as T | { error?: string; detail?: unknown };
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `request failed (${response.status})`;
    throw new ApiError(message, response.status, body);
  }
  return body as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
