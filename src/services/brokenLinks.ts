import { buildWikiIndex } from "./wikiIndex";
import { listMarkdown } from "./workspaceIo";

export async function findBrokenWikiLinks(): Promise<{ file: string; link: string }[]> {
  const { entries } = await buildWikiIndex();
  const known = new Set(entries.map((e) => e.title.toLowerCase()));
  const broken: { file: string; link: string }[] = [];

  for (const file of await listMarkdown()) {
    for (const m of file.text.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g)) {
      const title = m[1].trim();
      if (!known.has(title.toLowerCase())) {
        broken.push({ file: file.rel, link: title });
      }
    }
  }
  return broken;
}

export async function writeBrokenLinkReport(): Promise<string> {
  const broken = await findBrokenWikiLinks();
  const lines = ["# Broken wiki links", ""];
  if (!broken.length) lines.push("No broken `[[links]]` found.");
  else for (const b of broken) lines.push(`- ${b.file}: [[${b.link}]]`);
  const dest = "compile/broken-links.md";
  const { writeWorkspaceFile } = await import("./workspaceIo");
  await writeWorkspaceFile(dest, lines.join("\n") + "\n");
  return dest;
}
