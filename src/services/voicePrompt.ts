export interface VoiceModel {
  name: string;
  lines: number;
  avgLen: number;
  top: string[];
  sample: string;
}

export function voicePromptForSpeakers(speakers: string[], models: VoiceModel[]): string {
  const wanted = speakers.map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!wanted.length) return "";
  const hits = models.filter((m) => wanted.some((w) => m.name.toLowerCase().includes(w) || w.includes(m.name.toLowerCase())));
  if (!hits.length) return "";
  const lines = hits.map(
    (m) => `${m.name}: avg line ${m.avgLen.toFixed(0)} words; markers: ${m.top.join(", ")}; sample: ${m.sample}`,
  );
  return `Character voice models:\n${lines.join("\n")}`;
}
