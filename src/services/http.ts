import * as vscode from "vscode";
import { KeyManager } from "./keyManager";

const DEFAULT_TIMEOUT_MS = 120_000;

export function requestTimeoutMs(): number {
  const configured = vscode.workspace
    .getConfiguration("novelStudio")
    .get<number>("requestTimeoutMs");
  return typeof configured === "number" && configured > 0 ? configured : DEFAULT_TIMEOUT_MS;
}

/**
 * `fetch` with a hard deadline and support for VS Code cancellation. Without
 * this an unreachable local engine or a stalled provider leaves the command
 * hanging with no way out.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  token?: vscode.CancellationToken,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = requestTimeoutMs();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const cancelled = token?.onCancellationRequested(() => controller.abort());
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      if (token?.isCancellationRequested) throw new Error("Request cancelled.");
      throw new Error(
        `Request to ${new URL(url).host} timed out after ${Math.round(timeoutMs / 1000)}s.`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
    cancelled?.dispose();
  }
}

export async function jsonFetch<T>(
  url: string,
  init: RequestInit & { errorPrefix?: string } = {},
  token?: vscode.CancellationToken,
): Promise<T> {
  const { errorPrefix, ...rest } = init;
  const res = await fetchWithTimeout(url, rest, token);
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
