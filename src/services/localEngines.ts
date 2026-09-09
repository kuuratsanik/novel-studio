export const LOCAL_ENGINE_DEFAULTS: Record<string, string> = {
  ollama: "http://127.0.0.1:11434",
  kobold: "http://127.0.0.1:5001",
  oobabooga: "http://127.0.0.1:5000",
  tabby: "http://127.0.0.1:8080",
};

export const LOCAL_ENGINE_NAMES = new Set(Object.keys(LOCAL_ENGINE_DEFAULTS));

export function resolveLocalUrl(provider: string, configured: string): string {
  const fallback = LOCAL_ENGINE_DEFAULTS[provider];
  if (!fallback) return configured;
  if (configured === LOCAL_ENGINE_DEFAULTS.ollama && provider !== "ollama") return fallback;
  return configured;
}

export function isLocalProvider(provider: string): boolean {
  return LOCAL_ENGINE_NAMES.has(provider);
}
