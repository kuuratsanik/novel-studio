export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function sentenceLengths(text: string): number[] {
  return text
    .replace(/^---[\s\S]*?---\n/, "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.split(/\s+/).filter(Boolean).length)
    .filter((n) => n > 0);
}

export function filterWordHits(text: string, banned: string[]): string[] {
  const hits: string[] = [];
  const lower = text.toLowerCase();
  for (const w of banned) {
    const needle = (w || "").trim().toLowerCase();
    if (needle && lower.includes(needle)) hits.push(w);
  }
  return hits;
}

export function dialogueRatio(text: string): number {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return 0;
  const dialogue = lines.filter((l) => /^[\s>*"“'']/.test(l) || /"[^"]+"|'[^']+'/.test(l)).length;
  return dialogue / lines.length;
}

export function overlapScore(a: string, b: string): number {
  const wa = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const wb = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / Math.max(wa.size, wb.size);
}
