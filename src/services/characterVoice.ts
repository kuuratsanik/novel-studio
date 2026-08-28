import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";

export interface VoiceModel {
  name: string;
  lines: number;
  avgLen: number;
  top: string[];
  sample: string;
}

export async function buildVoiceModels(): Promise<VoiceModel[]> {
  const drafts = (await listMarkdown()).filter((f) => f.rel.startsWith("drafts/"));
  const byName = new Map<string, string[]>();
  const lineRe = /^[ \t]*([A-Z][A-Za-z][\w'-]{1,30})\s*[:—-]\s+(.+)$/gm;
  for (const d of drafts) {
    let m: RegExpExecArray | null;
    const text = d.text;
    while ((m = lineRe.exec(text))) {
      const arr = byName.get(m[1]) ?? [];
      arr.push(m[2].trim());
      byName.set(m[1], arr);
    }
  }
  const models: VoiceModel[] = [];
  for (const [name, lines] of byName) {
    if (lines.length < 3) continue;
    const words = lines.join(" ").toLowerCase().match(/[a-z']+/g) ?? [];
    const freq = new Map<string, number>();
    for (const w of words) {
      if (w.length < 4) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
    const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w]) => w);
    models.push({ name, lines: lines.length, avgLen: words.length / lines.length, top, sample: lines.slice(0, 3).join(" / ") });
  }
  await writeWorkspaceFile("codex/voice-models.json", JSON.stringify(models, null, 2) + "\n");
  return models;
}
