import * as vscode from "vscode";
import { resolveModelForTask } from "./modelDefaults";

export async function generateOllamaJson<T>(
  prompt: string,
  system: string,
  localUrl: string,
  model?: string,
): Promise<T | undefined> {
  const cfg = vscode.workspace.getConfiguration("novelStudio");
  const fast = cfg.get<string>("fastModel") || "qwen2.5:7b-instruct";
  const writer = cfg.get<string>("writerModel") || "qwen2.5:32b-instruct";
  const chosen = model || resolveModelForTask("ollama", "fast", fast, writer);
  try {
    const res = await fetch(`${localUrl.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: chosen,
        prompt: `${system}\n\n${prompt}\n\nRespond with valid JSON only.`,
        format: "json",
        stream: false,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { response?: string };
    if (!data.response?.trim()) return undefined;
    return JSON.parse(data.response) as T;
  } catch {
    return undefined;
  }
}
