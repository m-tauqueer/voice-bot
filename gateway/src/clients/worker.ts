import type { GatewayConfig } from "../config.js";

export async function callWorker(
  config: GatewayConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = new URL(path, config.WORKER_URL);
  const headers = new Headers(init.headers);
  headers.set(config.INTERNAL_SECRET_HEADER, config.INTERNAL_API_SECRET);
  return fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(config.WORKER_HTTP_TIMEOUT_MS),
  });
}
