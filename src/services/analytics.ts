import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";

export async function writeAnalytics(): Promise<void> {
  const files = await listMarkdown();
  const drafts = files.filter((f) => f.rel.startsWith("drafts/"));
  const totalWords = drafts.reduce((n, f) => n + f.text.split(/\s+/).filter(Boolean).length, 0);
  const lines = [
    "# Analytics",
    "",
    `| Metric | Value |`,
    `|---|---:|`,
    `| Draft files | ${drafts.length} |`,
    `| Total words | ${totalWords} |`,
    `| Codex / other md | ${files.length - drafts.length} |`,
    "",
  ];
  for (const f of drafts) {
    const w = f.text.split(/\s+/).filter(Boolean).length;
    lines.push(`- ${f.rel}: ${w} words`);
  }
  await writeWorkspaceFile("compile/analytics.md", lines.join("\n") + "\n");
}
