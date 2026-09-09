/** Fiction-oriented default models. "auto" resolves through resolveTextModel(). */
export const DEFAULT_TEXT_MODELS: Record<string, string> = {
  anthropic: "claude-sonnet-5",
  openrouter: "anthropic/claude-sonnet-5",
  openai: "gpt-4.1",
  ollama: "qwen2.5:32b-instruct",
  kobold: "qwen2.5:32b-instruct",
  deepinfra: "Qwen/Qwen2.5-32B-Instruct",
  together: "Qwen/Qwen2.5-32B-Instruct-Turbo",
  fireworks: "accounts/fireworks/models/qwen2p5-32b-instruct",
  novelai: "llama-3-erato-v1",
};

export const DEFAULT_FAST_MODEL = "qwen2.5:7b-instruct";
export const DEFAULT_WRITER_MODEL = "qwen2.5:32b-instruct";

export const LOCAL_TEXT_PROVIDERS = new Set(["ollama", "kobold"]);

export const DEFAULT_AUDIO_MODELS = {
  openai: "gpt-4o-mini-tts",
  elevenlabs: "eleven_multilingual_v2",
} as const;

export type ModelTask = "fast" | "writer" | "deep";

export function resolveTextModel(provider: string, model?: string): string {
  if (model && model !== "auto") return model;
  return DEFAULT_TEXT_MODELS[provider] ?? DEFAULT_TEXT_MODELS.ollama;
}

export function resolveModelForTask(provider: string, task: ModelTask, fastModel: string, writerModel: string): string {
  if (!LOCAL_TEXT_PROVIDERS.has(provider)) {
    return resolveTextModel(provider, "auto");
  }
  if (task === "fast") return fastModel || DEFAULT_FAST_MODEL;
  return writerModel || DEFAULT_WRITER_MODEL;
}

export function maxTokensForTask(task: ModelTask, base: number): number {
  if (task === "deep") return Math.max(base, 2048);
  if (task === "fast") return Math.min(base, 512);
  return base;
}
