import { KeyManager } from "./keyManager";

export async function jsonFetch<T>(
  url: string,
  init: RequestInit & { errorPrefix?: string } = {},
): Promise<T> {
  const { errorPrefix, ...rest } = init;
  const res = await fetch(url, rest);
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
