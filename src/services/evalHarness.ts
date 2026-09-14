import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";
import { overlapScore, wordCount } from "./proseStats";
import { loadContract, contractReady } from "./contracts";
import { auditContract } from "./contractAudit";

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

  let contractScore = 0;
  let contractTotal = 0;
  for (const d of drafts) {
    const loaded = await loadContract(d.rel);
    if (!loaded || !contractReady(loaded.contract)) continue;
    contractTotal++;
    const flags = auditContract(d.text, loaded.contract);
    const mustNotViolations = flags.filter((f) => f.message.includes("mustNot")).length;
    const mustIncludeMissing = flags.filter((f) => f.message.includes("mustInclude")).length;
    if (mustNotViolations === 0 && mustIncludeMissing === 0) contractScore++;
    lines.push(`- ${d.rel}: contract compliance ${mustNotViolations + mustIncludeMissing === 0 ? "✓" : `✗ (${flags.length} flags)`}`);
  }

  if (contractTotal) {
    lines.push("", `## Contract compliance: ${contractScore}/${contractTotal} chapters pass`, "");
  }

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
