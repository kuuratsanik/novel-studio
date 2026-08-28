import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";

export async function compileManuscript(): Promise<string[]> {
  const drafts = (await listMarkdown())
    .filter((f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"))
    .sort((a, b) => a.rel.localeCompare(b.rel));
  const body = drafts.map((d) => d.text.replace(/^---[\s\S]*?---\n/, "")).join("\n\n---\n\n");
  const md = await writeWorkspaceFile("compile/manuscript.md", `# Manuscript\n\n${body}\n`);
  return [md];
}
