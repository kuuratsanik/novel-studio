import * as vscode from "vscode";
import { KeyManager } from "./keyManager";
import { NovelAiService } from "./novelAiService";
import { maxTokensForTask, ModelTask, resolveTextModel } from "./modelDefaults";

function maxTokens(task: ModelTask = "writer"): number {
  const base = vscode.workspace.getConfiguration("novelStudio").get<number>("maxTokens") ?? 1024;
  return maxTokensForTask(task, base);
}

export class TextRouter {
  constructor(private readonly keys: KeyManager, private readonly novelai: NovelAiService) {}

  async generate(opts: {
    provider: string;
    model: string;
    localUrl?: string;
    prompt: string;
    systemPrompt?: string;
    context?: string;
    stream?: boolean;
    onToken?: (chunk: string) => void;
    signal?: AbortSignal;
    task?: ModelTask;
    json?: boolean;
  }): Promise<string> {
    const provider = opts.provider || "ollama";
    const task = opts.task || "writer";
    const signal = opts.signal;

    if (opts.json && (provider === "ollama" || provider === "kobold")) {
      return this.generateOllamaJson(opts, signal);
    }

    if (provider === "novelai") {
      const out = await this.novelai.generateText(opts);
      opts.onToken?.(out);
      return out;
    }

    const messages = [
      opts.systemPrompt ? { role: "system", content: opts.systemPrompt } : undefined,
      { role: "user", content: [opts.context, opts.prompt].filter(Boolean).join("\n\n") },
    ].filter(Boolean) as { role: string; content: string }[];

    if (provider === "anthropic") {
      const key = await this.keys.requireKey("anthropic", "Anthropic key missing.");
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: resolveTextModel(provider, opts.model),
          max_tokens: maxTokens(task),
          messages: messages.filter((m) => m.role !== "system"),
          system: opts.systemPrompt,
        }),
        signal,
      });
      const data = (await res.json()) as { content?: { text?: string }[]; error?: { message?: string } };
      if (!res.ok) throw new Error(data.error?.message || `Anthropic ${res.status}`);
      const out = (data.content || []).map((c) => c.text || "").join("").trim();
      opts.onToken?.(out);
      return out;
    }

    const openAiCompat: Record<string, { url: string; keyService?: string }> = {
      openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", keyService: "openrouter" },
      openai: { url: "https://api.openai.com/v1/chat/completions", keyService: "openai" },
      deepinfra: { url: "https://api.deepinfra.com/v1/openai/chat/completions", keyService: "deepinfra" },
      together: { url: "https://api.together.xyz/v1/chat/completions", keyService: "together" },
      fireworks: { url: "https://api.fireworks.ai/inference/v1/chat/completions", keyService: "fireworks" },
      ollama: { url: `${(opts.localUrl || "http://127.0.0.1:11434").replace(/\/$/, "")}/v1/chat/completions` },
      kobold: { url: `${(opts.localUrl || "http://127.0.0.1:5001").replace(/\/$/, "")}/v1/chat/completions` },
    };
    const conf = openAiCompat[provider] || openAiCompat.ollama;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (conf.keyService) {
      headers.Authorization = `Bearer ${await this.keys.requireKey(conf.keyService, `${conf.keyService} key missing.`)}`;
    }
    const model = resolveTextModel(provider, opts.model);
    const body = { model, messages, temperature: 0.8, max_tokens: maxTokens(task), stream: !!opts.stream };

    if (opts.stream && opts.onToken) {
      return this.streamOpenAi(conf.url, headers, body, opts.onToken, signal);
    }

    const res = await fetch(conf.url, { method: "POST", headers, body: JSON.stringify(body), signal });
    const raw = await res.text();
    if (!res.ok) throw new Error(`${provider} ${res.status}: ${raw.slice(0, 300)}`);
    const data = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
    const out = data.choices?.[0]?.message?.content || "";
    if (!out.trim()) throw new Error(`${provider} returned empty text.`);
    return out.trim();
  }

  private async generateOllamaJson(
    opts: { localUrl?: string; model: string; prompt: string; systemPrompt?: string; context?: string },
    signal?: AbortSignal,
  ): Promise<string> {
    const url = `${(opts.localUrl || "http://127.0.0.1:11434").replace(/\/$/, "")}/api/generate`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: resolveTextModel("ollama", opts.model),
        prompt: [opts.systemPrompt, opts.context, opts.prompt].filter(Boolean).join("\n\n"),
        format: "json",
        stream: false,
      }),
      signal,
    });
    if (!res.ok) throw new Error(`ollama json ${res.status}`);
    const data = (await res.json()) as { response?: string };
    return (data.response || "").trim();
  }

  private async streamOpenAi(
    url: string,
    headers: Record<string, string>,
    body: Record<string, unknown>,
    onToken: (chunk: string) => void,
    signal?: AbortSignal,
  ): Promise<string> {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body), signal });
    if (!res.ok) throw new Error(`stream ${res.status}: ${(await res.text()).slice(0, 300)}`);
    if (!res.body) throw new Error("stream body missing");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
          const chunk = json.choices?.[0]?.delta?.content || "";
          if (chunk) {
            full += chunk;
            onToken(chunk);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
    if (!full.trim()) throw new Error("stream returned empty text");
    return full.trim();
  }
}
