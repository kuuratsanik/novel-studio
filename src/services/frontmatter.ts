export function parseFrontmatter(text: string): { meta: Record<string, string>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { meta: {}, body: text };
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: text.slice(m[0].length) };
}

export function draftSortKey(rel: string, text: string): number {
  const { meta } = parseFrontmatter(text);
  if (meta.order) {
    const n = Number(meta.order);
    if (!Number.isNaN(n)) return n;
  }
  const num = rel.match(/(\d+)/);
  return num ? Number(num[1]) : rel.localeCompare("") + 1000;
}
