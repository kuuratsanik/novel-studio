import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";
import { naturalCompare } from "../core/sort";

export async function compileManuscript(): Promise<string[]> {
  const drafts = (await listMarkdown())
    .filter((f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"))
    .sort((a, b) => naturalCompare(a.rel, b.rel));
  const body = drafts.map((d) => d.text.replace(/^---[\s\S]*?---\n/, "").trim()).join("\n\n---\n\n");
  const md = await writeWorkspaceFile("compile/manuscript.md", `# Manuscript\n\n${body}\n`);
  return [md];
}
