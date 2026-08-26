import { listMarkdown } from "./workspaceIo";

export interface Bible {
  names: string[];
  headings: string[];
  text: string;
}

export async function loadBible(): Promise<Bible> {
  const files = (await listMarkdown()).filter((f) => f.rel.startsWith("codex/") || f.rel.startsWith("lore/"));
  const names = new Set<string>();
  const headings: string[] = [];
  const parts: string[] = [];
  for (const f of files) {
    parts.push(`# ${f.rel}\n${f.text}`);
    for (const m of f.text.matchAll(/^#{1,3}\s+(.+)$/gm)) {
      const title = m[1].trim();
      headings.push(title);
      names.add(title);
    }
  }
  const stop = new Set(["The", "A", "An", "Chapter", "Scene", "Added"]);
  const clean = [...names].filter((n) => !stop.has(n.split(" ")[0]) && n.length < 40);
  return { names: clean.sort(), headings, text: parts.join("\n\n").slice(0, 24_000) };
}

export function unknownNames(prose: string, bible: Bible): string[] {
  const found = new Set<string>();
  for (const m of prose.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/g)) {
    found.add(m[1]);
  }
  const known = new Set(bible.names.map((n) => n.toLowerCase()));
  const skip = new Set(["I", "The", "A", "An", "He", "She", "They", "It", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]);
  return [...found].filter((n) => !skip.has(n) && !known.has(n.toLowerCase()));
}

export function bibleLockPrompt(bible: Bible, allowException: boolean): string {
  const list = bible.names.slice(0, 80).join(", ") || "(empty bible)";
  const extra = allowException
    ? "New proper names are allowed only if marked [canon-exception]."
    : "Do not invent proper names, places, or factions outside this list.";
  return `Series bible lock. Canonical names:\n${list}\n${extra}`;
}
