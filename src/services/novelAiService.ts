import { resolveTextModel } from "./modelDefaults";

const NOVELAI_TEXT_API = "https://text.novelai.net/ai/generate";

export class NovelAiService {
  constructor(private readonly getToken: () => Promise<string | undefined>) {}

  async generateText(opts: { prompt: string; model?: string; systemPrompt?: string; context?: string }): Promise<string> {
    const token = await this.getToken();
    if (!token) throw new Error("NovelAI token missing. Run Novel Studio: Set NovelAI API Token.");
    const input = [opts.systemPrompt, opts.context, opts.prompt].filter(Boolean).join("\n\n");
    const model = resolveTextModel("novelai", opts.model);
    const res = await fetch(NOVELAI_TEXT_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input,
        model,
        parameters: { temperature: 0.8, max_length: 400, min_length: 1 },
      }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`NovelAI ${res.status}: ${raw.slice(0, 300)}`);
    try {
      const data = JSON.parse(raw) as { output?: string };
      return (data.output || "").trim();
    } catch {
      return raw.trim();
    }
  }
}
