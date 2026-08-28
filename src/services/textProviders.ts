import { KeyManager } from "./keyManager";
import { NovelAiService } from "./novelAiService";

export class TextRouter {
  constructor(private readonly keys: KeyManager, private readonly novelai: NovelAiService) {}

  async generate(opts: {
    provider: string;
    model: string;
    localUrl?: string;
    prompt: string;
    systemPrompt?: string;
    context?: string;
  }): Promise<string> {
    const provider = opts.provider || "ollama";
    if (provider === "novelai") {
      return this.novelai.generateText(opts);
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
          model: opts.model && opts.model !== "auto" ? opts.model : "claude-sonnet-4-20250514",
          max_tokens: 1024,
          messages: messages.filter((m) => m.role !== "system"),
          system: opts.systemPrompt,
        }),
      });
      const data = (await res.json()) as { content?: { text?: string }[]; error?: { message?: string } };
      if (!res.ok) throw new Error(data.error?.message || `Anthropic ${res.status}`);
      return (data.content || []).map((c) => c.text || "").join("").trim();
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
    const model =
      opts.model && opts.model !== "auto"
        ? opts.model
        : provider === "openrouter"
          ? "anthropic/claude-sonnet-4"
          : provider === "openai"
            ? "gpt-4o-mini"
            : "llama3.1";
    const res = await fetch(conf.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.8 }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`${provider} ${res.status}: ${raw.slice(0, 300)}`);
    const data = JSON.parse(raw) as { choices?: { message?: { content?: string } }[] };
    const out = data.choices?.[0]?.message?.content || "";
    if (!out.trim()) throw new Error(`${provider} returned empty text.`);
    return out.trim();
  }
}
