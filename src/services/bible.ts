import { listMarkdown } from "./workspaceIo";
import { Bible, isStructuralHeading } from "../core/names";

export { unknownNames, findUnknownNames, bibleLockPrompt, isStructuralHeading } from "../core/names";
export type { Bible, NameMatch } from "../core/names";

export async function loadBible(): Promise<Bible> {
  const files = (await listMarkdown()).filter(
    (f) => f.rel.startsWith("codex/") || f.rel.startsWith("lore/"),
  );
  const names = new Set<string>();
  const headings: string[] = [];
  const parts: string[] = [];
  for (const f of files) {
    parts.push(`# ${f.rel}\n${f.text}`);
    for (const m of f.text.matchAll(/^#{1,3}\s+(.+)$/gm)) {
      const title = m[1].trim();
      headings.push(title);
      if (!isStructuralHeading(title)) names.add(title);
    }
  }
  const stop = new Set(["The", "A", "An", "Chapter", "Scene", "Added"]);
  const clean = [...names].filter((n) => !stop.has(n.split(" ")[0]) && n.length < 40);
  return { names: clean.sort(), headings, text: parts.join("\n\n").slice(0, 24_000) };
}
