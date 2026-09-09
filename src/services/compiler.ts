import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";
import { draftSortKey } from "./frontmatter";

function stripForCompile(text: string): string {
  return text
    .replace(/^---[\s\S]*?---\n/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^>\s.*$/gm, "")
    .trim();
}

export async function compileManuscript(): Promise<string[]> {
  const drafts = (await listMarkdown())
    .filter((f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"))
    .sort((a, b) => draftSortKey(a.rel, a.text) - draftSortKey(b.rel, b.text));

  const body = drafts.map((d) => stripForCompile(d.text)).filter(Boolean).join("\n\n---\n\n");
  const toc = drafts.map((d, i) => `${i + 1}. ${d.rel.replace(/^drafts\//, "").replace(/\.md$/, "")}`).join("\n");
  const md = await writeWorkspaceFile(
    "compile/manuscript.md",
    `# Manuscript\n\n## Table of contents\n\n${toc}\n\n---\n\n${body}\n`,
  );
  return [md];
}
