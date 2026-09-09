import { listMarkdown, writeWorkspaceFile, readWorkspaceFile } from "./workspaceIo";
import { dialogueRatio, wordCount } from "./proseStats";
import { loadContract, contractReady } from "./contracts";

export async function writeAnalytics(): Promise<void> {
  const files = await listMarkdown();
  const drafts = files.filter((f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"));
  const totalWords = drafts.reduce((n, f) => n + wordCount(f.text), 0);

  let target = 80000;
  try {
    const studio = JSON.parse(await readWorkspaceFile("studio.json")) as { wordTarget?: number };
    if (studio.wordTarget) target = studio.wordTarget;
  } catch {
    // default target
  }

  let contractsReady = 0;
  for (const d of drafts) {
    const loaded = await loadContract(d.rel);
    if (loaded && contractReady(loaded.contract)) contractsReady++;
  }

  const lines = [
    "# Analytics",
    "",
    `| Metric | Value |`,
    `|---|---:|`,
    `| Draft files | ${drafts.length} |`,
    `| Total words | ${totalWords} |`,
    `| Word target | ${target} |`,
    `| Progress | ${((totalWords / target) * 100).toFixed(1)}% |`,
    `| Contracts ready | ${contractsReady}/${drafts.length} |`,
    `| Codex / other md | ${files.length - drafts.length} |`,
    "",
    "## Per chapter",
    "",
  ];

  for (const f of drafts.sort((a, b) => a.rel.localeCompare(b.rel))) {
    const w = wordCount(f.text);
    const ratio = (dialogueRatio(f.text) * 100).toFixed(0);
    lines.push(`- ${f.rel}: ${w} words · ${ratio}% dialogue-ish lines`);
  }

  await writeWorkspaceFile("compile/analytics.md", lines.join("\n") + "\n");
}
