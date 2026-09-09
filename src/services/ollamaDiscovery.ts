export async function listOllamaModels(localUrl = "http://127.0.0.1:11434"): Promise<string[]> {
  try {
    const res = await fetch(`${localUrl.replace(/\/$/, "")}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name: string }[] };
    return (data.models || []).map((m) => m.name).sort();
  } catch {
    return [];
  }
}
