import * as vscode from "vscode";
import { KeyManager } from "./keyManager";
import { NovelAiService } from "./novelAiService";
import { fetchWithTimeout } from "./http";

export interface GenerateOptions {
  provider: string;
  model: string;
  localUrl?: string;
  prompt: string;
  systemPrompt?: string;
  context?: string;
  token?: vscode.CancellationToken;
}

const OPENAI_COMPATIBLE: Record<string, { url: (localUrl?: string) => string; keyService?: string }> = {
  openrouter: { url: () => "https://openrouter.ai/api/v1/chat/completions", keyService: "openrouter" },
  openai: { url: () => "https://api.openai.com/v1/chat/completions", keyService: "openai" },
  deepinfra: { url: () => "https://api.deepinfra.com/v1/openai/chat/completions", keyService: "deepinfra" },
  together: { url: () => "https://api.together.xyz/v1/chat/completions", keyService: "together" },
  fireworks: { url: () => "https://api.fireworks.ai/inference/v1/chat/completions", keyService: "fireworks" },
  ollama: {
    url: (localUrl) => `${(localUrl || "http://127.0.0.1:11434").replace(/\/$/, "")}/v1/chat/completions`,
  },
  kobold: {
    url: (localUrl) => `${(localUrl || "http://127.0.0.1:5001").replace(/\/$/, "")}/v1/chat/completions`,
  },
};

function defaultModel(provider: string): string {
  if (provider === "openrouter") return "anthropic/claude-sonnet-4";
  if (provider === "openai") return "gpt-4o-mini";
  return "llama3.1";
}

export class TextRouter {
  constructor(
    private readonly keys: KeyManager,
    private readonly novelai: NovelAiService,
  ) {}

  async generate(opts: GenerateOptions): Promise<string> {
    const provider = opts.provider || "ollama";
    if (provider === "novelai") {
      return this.novelai.generateText(opts);
    }

    const messages = [
      opts.systemPrompt ? { role: "system", content: opts.systemPrompt } : undefined,
      { role: "user", content: [opts.context, opts.prompt].filter(Boolean).join("\n\n") },
    ].filter(Boolean) as { role: string; content: string }[];

    if (provider === "anthropic") {
      return this.anthropic(opts, messages);
    }

    const conf = OPENAI_COMPATIBLE[provider] || OPENAI_COMPATIBLE.ollama;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (conf.keyService) {
      const key = await this.keys.requireKey(conf.keyService, `${conf.keyService} key missing.`);
      headers.Authorization = `Bearer ${key}`;
    }
    const model = opts.model && opts.model !== "auto" ? opts.model : defaultModel(provider);

    const res = await fetchWithTimeout(
      conf.url(opts.localUrl),
      { method: "POST", headers, body: JSON.stringify({ model, messages, temperature: 0.8 }) },
      opts.token,
    );
    const raw = await res.text();
    if (!res.ok) throw new Error(`${provider} ${res.status}: ${raw.slice(0, 300)}`);

    let data: { choices?: { message?: { content?: string } }[] };
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      throw new Error(`${provider} returned non-JSON: ${raw.slice(0, 200)}`);
    }
    const out = data.choices?.[0]?.message?.content || "";
    if (!out.trim()) throw new Error(`${provider} returned empty text.`);
    return out.trim();
  }

  private async anthropic(
    opts: GenerateOptions,
    messages: { role: string; content: string }[],
  ): Promise<string> {
    const key = await this.keys.requireKey("anthropic", "Anthropic key missing.");
    const res = await fetchWithTimeout(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model && opts.model !== "auto" ? opts.model : "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: messages.filter((m) => m.role !== "system"),
          system: opts.systemPrompt,
        }),
      },
      opts.token,
    );
    const raw = await res.text();
    let data: { content?: { text?: string }[]; error?: { message?: string } } = {};
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${raw.slice(0, 300)}`);
      throw new Error(`Anthropic returned non-JSON: ${raw.slice(0, 200)}`);
    }
    if (!res.ok) throw new Error(data.error?.message || `Anthropic ${res.status}`);
    const out = (data.content || []).map((c) => c.text || "").join("").trim();
    if (!out) throw new Error("Anthropic returned empty text.");
    return out;
  }
}
