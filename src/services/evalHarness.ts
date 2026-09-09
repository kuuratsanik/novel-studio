import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";
import { overlapScore, wordCount } from "./proseStats";

export async function runEval(): Promise<string> {
  const files = await listMarkdown();
  const gold = files.filter((f) => f.rel.startsWith("gold/"));
  const drafts = files.filter((f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"));

  const lines = [
    "# Eval report",
    "",
    `| Metric | Value |`,
    `|---|---:|`,
    `| Gold scenes | ${gold.length} |`,
    `| Draft files | ${drafts.length} |`,
    "",
  ];

  if (gold.length && drafts.length) {
    lines.push("## Gold vs latest draft overlap", "");
    const latest = drafts.sort((a, b) => b.rel.localeCompare(a.rel))[0];
    for (const g of gold) {
      const score = overlapScore(g.text, latest.text);
      lines.push(`- ${g.rel} vs ${latest.rel}: ${(score * 100).toFixed(1)}% token overlap`);
    }
    lines.push("");
  }

  lines.push("## Draft word counts", "");
  for (const d of drafts.sort((a, b) => a.rel.localeCompare(b.rel))) {
    lines.push(`- ${d.rel}: ${wordCount(d.text)} words`);
  }

  const report = lines.join("\n") + "\n";
  await writeWorkspaceFile("compile/eval.md", report);
  return report;
}
