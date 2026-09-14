import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";
import { dialogueRatio, wordCount } from "./proseStats";
import { loadContract, contractReady } from "./contracts";
import { draftSortKey } from "./frontmatter";
import { loadStudioConfig } from "./studioConfig";
import { sessionSummary } from "./sessionAnalytics";

export interface AnalyticsSnapshot {
  totalWords: number;
  wordTarget: number;
  progressPct: number;
  draftCount: number;
  contractsReady: number;
  codexFiles: number;
  chapters: { rel: string; words: number; dialoguePct: number }[];
  streak?: number;
  todayWords?: number;
}

export async function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const files = await listMarkdown();
  const drafts = files.filter((f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"));
  const totalWords = drafts.reduce((n, f) => n + wordCount(f.text), 0);

  const studio = await loadStudioConfig();
  const target = studio.wordTarget || 80000;

  let contractsReady = 0;
  for (const d of drafts) {
    const loaded = await loadContract(d.rel);
    if (loaded && contractReady(loaded.contract)) contractsReady++;
  }

  const chapters = drafts
    .sort((a, b) => draftSortKey(a.rel, a.text) - draftSortKey(b.rel, b.text))
    .map((f) => ({
      rel: f.rel,
      words: wordCount(f.text),
      dialoguePct: Math.round(dialogueRatio(f.text) * 100),
    }));

  const session = await sessionSummary(totalWords);

  return {
    totalWords,
    wordTarget: target,
    progressPct: target ? Math.round((totalWords / target) * 1000) / 10 : 0,
    draftCount: drafts.length,
    contractsReady,
    codexFiles: files.length - drafts.length,
    chapters,
    streak: session.streak,
    todayWords: session.todayWords,
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
    `| Writing streak | ${snap.streak ?? 0} day(s) |`,
    `| Words today | ${snap.todayWords ?? 0} |`,
    "",
    "## Per chapter",
    "",
  ];

  for (const ch of snap.chapters) {
    lines.push(`- ${ch.rel}: ${ch.words} words · ${ch.dialoguePct}% dialogue-ish lines`);
  }

  await writeWorkspaceFile("compile/analytics.md", lines.join("\n") + "\n");
}
