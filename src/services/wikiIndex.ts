import { listMarkdown } from "./workspaceIo";

export interface WikiEntry {
  title: string;
  path: string;
  heading?: string;
  mentions: number;
}

/**
 * Build wiki index from definitions only (file stems + headings).
 * Mentions via [[links]] increment counts but do not invent new definitions —
 * otherwise broken-link detection can never find anything.
 */
export async function buildWikiIndex(): Promise<{
  entries: WikiEntry[];
  report: string;
}> {
  const files = await listMarkdown();
  const byTitle = new Map<string, WikiEntry>();

  for (const file of files) {
    const stem = file.rel.replace(/^.*\//, "").replace(/\.md$/i, "");
    const stemTitle = stem.replace(/[_-]+/g, " ");
    byTitle.set(stemTitle.toLowerCase(), {
      title: stemTitle,
      path: file.rel,
      mentions: 0,
    });
    for (const m of file.text.matchAll(/^#{1,3}\s+(.+)$/gm)) {
      const heading = m[1].trim();
      const key = heading.toLowerCase();
      const existing = byTitle.get(key);
      if (existing) {
        if (!existing.heading) existing.heading = heading;
      } else {
        byTitle.set(key, { title: heading, path: file.rel, heading, mentions: 0 });
      }
    }
  }

  for (const file of files) {
    for (const m of file.text.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g)) {
      const existing = byTitle.get(m[1].trim().toLowerCase());
      if (existing) existing.mentions += 1;
    }
  }

  const entries = [...byTitle.values()].sort((a, b) => a.title.localeCompare(b.title));
  const report = entries
    .map((e) => `- [[${e.title}]] — ${e.path}${e.mentions ? ` (${e.mentions} mention${e.mentions === 1 ? "" : "s"})` : ""}`)
    .join("\n");
  return { entries, report: report || "No wiki entries yet. Use [[Character Name]] in drafts or codex." };
}

export function insertWikiLink(title: string): string {
  return `[[${title}]]`;
}
