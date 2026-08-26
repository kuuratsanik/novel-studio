import { listMarkdown } from "./workspaceIo";

export interface WikiEntry {
  title: string;
  path: string;
  heading?: string;
  mentions: number;
}

export async function buildWikiIndex(): Promise<{
  entries: WikiEntry[];
  report: string;
}> {
  const files = await listMarkdown();
  const byTitle = new Map<string, WikiEntry>();

  const add = (title: string, path: string, heading?: string) => {
    const key = title.toLowerCase();
    const existing = byTitle.get(key);
    if (existing) {
      existing.mentions += 1;
      return;
    }
    byTitle.set(key, { title, path, heading, mentions: 1 });
  };

  for (const file of files) {
    const stem = file.rel.replace(/^.*\//, "").replace(/\.md$/i, "");
    add(stem.replace(/[_-]+/g, " "), file.rel);
    for (const m of file.text.matchAll(/^#{1,3}\s+(.+)$/gm)) {
      add(m[1].trim(), file.rel, m[1].trim());
    }
    for (const m of file.text.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g)) {
      add(m[1].trim(), file.rel);
    }
  }

  const entries = [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title));
  const report = entries
    .map((e) => `- [[${e.title}]] — ${e.path}${e.mentions > 1 ? ` (${e.mentions})` : ""}`)
    .join("\n");
  return { entries, report: report || "No wiki entries yet. Use [[Character Name]] in drafts or codex." };
}

export function insertWikiLink(title: string): string {
  return `[[${title}]]`;
}
