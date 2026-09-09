import { KeyManager } from "./keyManager";

export function abortAfter(ms: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  if (typeof timer === "object" && typeof (timer as NodeJS.Timeout).unref === "function") {
    (timer as NodeJS.Timeout).unref();
  }
  return controller.signal;
}

export async function timedFetch(url: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<Response> {
  const { timeoutMs = 120_000, signal, ...rest } = init;
  const used = signal ?? abortAfter(timeoutMs);
  try {
    return await fetch(url, { ...rest, signal: used });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}

export async function jsonFetch<T>(
  url: string,
  init: RequestInit & { errorPrefix?: string; timeoutMs?: number } = {},
): Promise<T> {
  const { errorPrefix, timeoutMs, ...rest } = init;
  const res = await timedFetch(url, { ...rest, timeoutMs });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`${errorPrefix || "HTTP"} ${res.status}: ${raw.slice(0, 400)}`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${errorPrefix || "HTTP"} returned non-JSON: ${raw.slice(0, 200)}`);
  }
}

export async function bearer(keys: KeyManager, service: string, missing: string): Promise<string> {
  const k = await keys.getKey(service);
  if (!k) throw new Error(missing);
  return k;
}
