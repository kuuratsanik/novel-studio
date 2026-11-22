import * as vscode from "vscode";
import { listMarkdown, uriFor, writeWorkspaceFile } from "./workspaceIo";
import { auditProse, ContinuityFlag } from "./continuity";
import { lintWorkspaceGrammar, writeGrammarReport } from "./grammarLint";
import { findBrokenWikiLinks, writeBrokenLinkReport } from "./brokenLinks";
import { contractReady, loadContract } from "./contracts";
import { loadManuscriptGraph } from "./manuscriptGraph";
import { saveManuscriptGraph } from "./manuscriptGraph";

export interface FileAudit {
  rel: string;
  flags: ContinuityFlag[];
  contractReady: boolean;
}

export interface AuditAllSummary {
  chapters: number;
  continuityFlags: number;
  warnings: number;
  info: number;
  grammarFlags: number;
  brokenLinks: number;
  contractsReady: number;
  orphanCharacters: string[];
  worstChapters: { rel: string; count: number }[];
  reportPath: string;
}

export async function auditAllDrafts(): Promise<FileAudit[]> {
  const drafts = (await listMarkdown()).filter(
    (f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"),
  );
  const results: FileAudit[] = [];
  for (const d of drafts) {
    const loaded = await loadContract(d.rel);
    results.push({
      rel: d.rel,
      flags: await auditProse(d.text, d.rel),
      contractReady: !!(loaded && contractReady(loaded.contract)),
    });
  }
  return results;
}

export async function writeAuditAllReport(): Promise<AuditAllSummary> {
  // Ensure graph exists for orphan detection
  await saveManuscriptGraph().catch(() => undefined);

  const fileAudits = await auditAllDrafts();
  const grammar = await lintWorkspaceGrammar();
  await writeGrammarReport(grammar);
  const broken = await findBrokenWikiLinks();
  await writeBrokenLinkReport();

  const graph = await loadManuscriptGraph();
  const orphanCharacters: string[] = [];
  if (graph) {
    for (const e of graph.entities.filter((x) => x.kind === "character")) {
      const appears = graph.edges.some((edge) => edge.from === e.id && edge.rel === "appears-in");
      if (!appears) orphanCharacters.push(e.name);
    }
  }

  const warnings = fileAudits.reduce((n, f) => n + f.flags.filter((x) => x.severity === "warning").length, 0);
  const info = fileAudits.reduce((n, f) => n + f.flags.filter((x) => x.severity === "information").length, 0);
  const totalFlags = warnings + info;
  const contractsReady = fileAudits.filter((f) => f.contractReady).length;
  const worstChapters = [...fileAudits]
    .sort((a, b) => b.flags.length - a.flags.length)
    .slice(0, 5)
    .filter((f) => f.flags.length > 0)
    .map((f) => ({ rel: f.rel, count: f.flags.length }));

  const lines = [
    "# Audit all — workspace",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Check | Result |",
    "|---|---|",
    `| Draft chapters | ${fileAudits.length} |`,
    `| Continuity flags | ${totalFlags} (${warnings} warning / ${info} info) |`,
    `| Grammar/style flags | ${grammar.length} |`,
    `| Broken wiki links | ${broken.length} |`,
    `| Contracts ready | ${contractsReady}/${fileAudits.length} |`,
    `| Orphan characters | ${orphanCharacters.length} |`,
    `| Broken links report | compile/broken-links.md |`,
    `| Grammar report | compile/grammar-lint.md |`,
    "",
  ];

  if (worstChapters.length) {
    lines.push("## Highest-flag chapters", "");
    for (const w of worstChapters) {
      lines.push(`- ${w.rel}: ${w.count} flag(s)`);
    }
    lines.push("");
  }

  if (orphanCharacters.length) {
    lines.push("## Orphan characters (in state/codex, never appear in a chapter)", "");
    for (const n of orphanCharacters) lines.push(`- ${n}`);
    lines.push("");
  }

  lines.push("## Continuity by chapter", "");

  for (const f of fileAudits) {
    const ready = f.contractReady ? "contract✓" : "contract✗";
    lines.push(`### ${f.rel} (${f.flags.length} flag(s), ${ready})`, "");
    if (!f.flags.length) {
      lines.push("_No flags._", "");
      continue;
    }
    for (const flag of f.flags.slice(0, 30)) {
      lines.push(`- [${flag.severity}] ${flag.message}`);
    }
    if (f.flags.length > 30) lines.push(`- … and ${f.flags.length - 30} more`);
    lines.push("");
  }

  if (broken.length) {
    lines.push("## Broken wiki links (sample)", "");
    for (const b of broken.slice(0, 40)) {
      lines.push(`- ${b.file}: [[${b.link}]]`);
    }
    if (broken.length > 40) lines.push(`\n… and ${broken.length - 40} more`);
    lines.push("");
  }

  if (grammar.length) {
    lines.push("## Grammar & style (sample)", "");
    for (const g of grammar.slice(0, 40)) {
      lines.push(`- ${g.file}:${g.line} — ${g.message}`);
    }
    if (grammar.length > 40) lines.push(`\n… and ${grammar.length - 40} more`);
    lines.push("");
  }

  const reportPath = await writeWorkspaceFile("compile/audit-all.md", lines.join("\n") + "\n");
  return {
    chapters: fileAudits.length,
    continuityFlags: totalFlags,
    warnings,
    info,
    grammarFlags: grammar.length,
    brokenLinks: broken.length,
    contractsReady,
    orphanCharacters,
    worstChapters,
    reportPath,
  };
}

export async function openAuditAllReport(): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(uriFor("compile/audit-all.md"));
  await vscode.window.showTextDocument(doc, { preview: false, viewColumn: vscode.ViewColumn.Beside });
}
