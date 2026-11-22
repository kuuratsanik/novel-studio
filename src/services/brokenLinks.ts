import { listMarkdown } from "./workspaceIo";
import { findBrokenWikiLinksInFiles } from "./wikiUtil";

export async function findBrokenWikiLinks(): Promise<{ file: string; link: string }[]> {
  const files = await listMarkdown();
  return findBrokenWikiLinksInFiles(files);
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
