import { KeyManager } from "./keyManager";
import { NovelAiService } from "./novelAiService";
import { jsonFetch } from "./http";
import { LOCAL_ENGINE_DEFAULTS } from "./localEngines";

type ChatMessage = { role: string; content: string };

export class TextRouter {
  constructor(private readonly keys: KeyManager, private readonly novelai: NovelAiService) {}

  async generate(opts: {
    provider: string;
    model: string;
    localUrl?: string;
    prompt: string;
    systemPrompt?: string;
    context?: string;
    timeoutMs?: number;
  }): Promise<string> {
    const provider = opts.provider || "ollama";
    const timeoutMs = opts.timeoutMs ?? 120_000;
    if (provider === "novelai") {
      return this.novelai.generateText({ ...opts, timeoutMs });
    }
    if (provider === "gemini") {
      return this.gemini(opts, timeoutMs);
    }

    const messages: ChatMessage[] = [
      ...(opts.systemPrompt ? [{ role: "system", content: opts.systemPrompt }] : []),
      { role: "user", content: [opts.context, opts.prompt].filter(Boolean).join("\n\n") },
    ];

    if (provider === "anthropic") {
      const key = await this.keys.requireKey("anthropic", "Anthropic key missing.");
      const data = await jsonFetch<{ content?: { text?: string }[]; error?: { message?: string } }>(
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
          errorPrefix: "Anthropic",
          timeoutMs,
        },
      );
      return (data.content || []).map((c) => c.text || "").join("").trim();
    }

    const openAiCompat: Record<string, { url: string; keyService?: string }> = {
      openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", keyService: "openrouter" },
      openai: { url: "https://api.openai.com/v1/chat/completions", keyService: "openai" },
      deepinfra: { url: "https://api.deepinfra.com/v1/openai/chat/completions", keyService: "deepinfra" },
      together: { url: "https://api.together.xyz/v1/chat/completions", keyService: "together" },
      fireworks: { url: "https://api.fireworks.ai/inference/v1/chat/completions", keyService: "fireworks" },
      ollama: { url: `${(opts.localUrl || LOCAL_ENGINE_DEFAULTS.ollama).replace(/\/$/, "")}/v1/chat/completions` },
      kobold: { url: `${(opts.localUrl || LOCAL_ENGINE_DEFAULTS.kobold).replace(/\/$/, "")}/v1/chat/completions` },
      oobabooga: { url: `${(opts.localUrl || LOCAL_ENGINE_DEFAULTS.oobabooga).replace(/\/$/, "")}/v1/chat/completions` },
      tabby: { url: `${(opts.localUrl || LOCAL_ENGINE_DEFAULTS.tabby).replace(/\/$/, "")}/v1/chat/completions` },
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
    const data = await jsonFetch<{ choices?: { message?: { content?: string } }[] }>(conf.url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.8 }),
      errorPrefix: provider,
      timeoutMs,
    });
    const out = data.choices?.[0]?.message?.content || "";
    if (!out.trim()) throw new Error(`${provider} returned empty text.`);
    return out.trim();
  }

  private async gemini(
    opts: { model: string; prompt: string; systemPrompt?: string; context?: string },
    timeoutMs: number,
  ): Promise<string> {
    const key = await this.keys.requireKey("gemini", "Gemini key missing.");
    const model = opts.model && opts.model !== "auto" ? opts.model : "gemini-2.5-flash";
    const user = [opts.context, opts.prompt].filter(Boolean).join("\n\n");
    const data = await jsonFetch<{
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    }>(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        ...(opts.systemPrompt ? { systemInstruction: { parts: [{ text: opts.systemPrompt }] } } : {}),
        contents: [{ role: "user", parts: [{ text: user }] }],
      }),
      errorPrefix: "Gemini",
      timeoutMs,
    });
    const out = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
    if (!out) throw new Error("Gemini returned empty text.");
    return out;
  }
}
