import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";
import { auditProse, ContinuityFlag } from "./continuity";
import { lintWorkspaceGrammar, writeGrammarReport } from "./grammarLint";
import { writeBrokenLinkReport } from "./brokenLinks";
import { contractReady, loadContract } from "./contracts";

export interface FileAudit {
  rel: string;
  flags: ContinuityFlag[];
}

export async function auditAllDrafts(): Promise<FileAudit[]> {
  const drafts = (await listMarkdown()).filter(
    (f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"),
  );
  const results: FileAudit[] = [];
  for (const d of drafts) {
    results.push({ rel: d.rel, flags: await auditProse(d.text, d.rel) });
  }
  return results;
}

export async function writeAuditAllReport(): Promise<string> {
  const fileAudits = await auditAllDrafts();
  await writeGrammarReport();
  const grammar = await lintWorkspaceGrammar();

  let broken = "compile/broken-links.md";
  try {
    broken = await writeBrokenLinkReport();
  } catch {
    // workspace not ready
  }

  let contractsReady = 0;
  for (const { rel } of fileAudits) {
    const loaded = await loadContract(rel);
    if (loaded && contractReady(loaded.contract)) contractsReady++;
  }

  const totalFlags = fileAudits.reduce((n, f) => n + f.flags.length, 0);
  const lines = [
    "# Audit all — workspace",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "| Check | Result |",
    "|---|---|",
    `| Draft chapters | ${fileAudits.length} |`,
    `| Continuity flags | ${totalFlags} |`,
    `| Grammar/style flags | ${grammar.length} |`,
    `| Contracts ready | ${contractsReady}/${fileAudits.length} |`,
    `| Broken links | ${broken} |`,
    `| Grammar report | compile/grammar-lint.md |`,
    "",
    "## Continuity by chapter",
    "",
  ];

  for (const f of fileAudits) {
    lines.push(`### ${f.rel} (${f.flags.length} flag(s))`, "");
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

  return writeWorkspaceFile("compile/audit-all.md", lines.join("\n") + "\n");
}