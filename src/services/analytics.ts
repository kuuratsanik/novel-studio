import { listMarkdown, writeWorkspaceFile, readWorkspaceFile } from "./workspaceIo";
import { dialogueRatio, wordCount } from "./proseStats";
import { loadContract, contractReady } from "./contracts";

export interface AnalyticsSnapshot {
  totalWords: number;
  wordTarget: number;
  progressPct: number;
  draftCount: number;
  contractsReady: number;
  codexFiles: number;
  chapters: { rel: string; words: number; dialoguePct: number }[];
}

export async function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const files = await listMarkdown();
  const drafts = files.filter((f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"));
  const totalWords = drafts.reduce((n, f) => n + wordCount(f.text), 0);

  let target = 80000;
  try {
    const studio = JSON.parse(await readWorkspaceFile("studio.json")) as { wordTarget?: number };
    if (studio.wordTarget) target = studio.wordTarget;
  } catch {
    // default
  }

  let contractsReady = 0;
  for (const d of drafts) {
    const loaded = await loadContract(d.rel);
    if (loaded && contractReady(loaded.contract)) contractsReady++;
  }

  const chapters = drafts
    .sort((a, b) => a.rel.localeCompare(b.rel))
    .map((f) => ({
      rel: f.rel,
      words: wordCount(f.text),
      dialoguePct: Math.round(dialogueRatio(f.text) * 100),
    }));

  return {
    totalWords,
    wordTarget: target,
    progressPct: target ? Math.round((totalWords / target) * 1000) / 10 : 0,
    draftCount: drafts.length,
    contractsReady,
    codexFiles: files.length - drafts.length,
    chapters,
  };
}

export async function writeAnalytics(): Promise<void> {
  const snap = await getAnalyticsSnapshot();
  const lines = [
    "# Analytics",
    "",
    `| Metric | Value |`,
    `|---|---:|`,
    `| Draft files | ${snap.draftCount} |`,
    `| Total words | ${snap.totalWords} |`,
    `| Word target | ${snap.wordTarget} |`,
    `| Progress | ${snap.progressPct}% |`,
    `| Contracts ready | ${snap.contractsReady}/${snap.draftCount} |`,
    `| Codex / other md | ${snap.codexFiles} |`,
    "",
    "## Per chapter",
    "",
  ];

  for (const ch of snap.chapters) {
    lines.push(`- ${ch.rel}: ${ch.words} words · ${ch.dialoguePct}% dialogue-ish lines`);
  }

  await writeWorkspaceFile("compile/analytics.md", lines.join("\n") + "\n");
}
