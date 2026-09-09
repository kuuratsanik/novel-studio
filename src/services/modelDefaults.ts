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

export const LOCAL_TEXT_PROVIDERS = new Set(["ollama", "kobold"]);

export const DEFAULT_AUDIO_MODELS = {
  openai: "gpt-4o-mini-tts",
  elevenlabs: "eleven_multilingual_v2",
} as const;

export function resolveTextModel(provider: string, model?: string): string {
  if (model && model !== "auto") return model;
  return DEFAULT_TEXT_MODELS[provider] ?? DEFAULT_TEXT_MODELS.ollama;
}
