import * as vscode from "vscode";
import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";
import { loadStudioConfig } from "./studioConfig";
import { filterWordHits } from "./proseStats";
import { lintWithLanguageTool } from "./languageToolLint";

export interface GrammarFlag {
  file: string;
  line: number;
  message: string;
  excerpt: string;
}

function stripFrontmatterLines(lines: string[]): { start: number; body: string[] } {
  if (lines[0]?.trim() !== "---") return { start: 0, body: lines };
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end < 0) return { start: 0, body: lines };
  return { start: end + 1, body: lines.slice(end + 1) };
}

export async function lintWorkspaceGrammar(): Promise<GrammarFlag[]> {
  const studio = await loadStudioConfig();
  const flags: GrammarFlag[] = [];
  const useLt = vscode.workspace.getConfiguration("novelStudio").get<boolean>("languageToolLint") ?? false;

  for (const file of await listMarkdown()) {
    if (!file.rel.startsWith("drafts/") && !file.rel.startsWith("codex/")) continue;
    if (file.rel.includes("/contracts/")) continue;

    const rawLines = file.text.split(/\r?\n/);
    const { start, body } = stripFrontmatterLines(rawLines);

    for (let i = 0; i < body.length; i++) {
      const line = body[i];
      const lineNo = start + i + 1;
      if (!line.trim() || line.startsWith("#") || line.startsWith(">") || line.startsWith("|")) continue;
      if (line.startsWith("```") || line.startsWith("    ")) continue;

      for (const w of filterWordHits(line, studio.banned || [])) {
        flags.push({ file: file.rel, line: lineNo, message: `Banned word: ${w}`, excerpt: line.trim().slice(0, 80) });
      }
      // Flag mid-sentence double spaces only (not indent / alignment)
      if (/[^\s]\s{2,}[^\s]/.test(line)) {
        flags.push({ file: file.rel, line: lineNo, message: "Double spaces", excerpt: line.trim().slice(0, 80) });
      }
      if (/\bvery\s+very\b/i.test(line)) {
        flags.push({
          file: file.rel,
          line: lineNo,
          message: "Weak intensifier repetition",
          excerpt: line.trim().slice(0, 80),
        });
      }
    }

    if (useLt && file.rel.startsWith("drafts/")) {
      const prose = body.join("\n").slice(0, 6000);
      const matches = await lintWithLanguageTool(prose);
      for (const m of matches.slice(0, 15)) {
        const before = prose.slice(0, m.offset);
        const line = before.split(/\r?\n/).length + start;
        flags.push({
          file: file.rel,
          line,
          message: `LanguageTool: ${m.message}`,
          excerpt: prose.slice(m.offset, m.offset + m.length).slice(0, 80),
        });
      }
    }
  }

  return flags;
}

export async function writeGrammarReport(flags?: GrammarFlag[]): Promise<string> {
  const found = flags ?? (await lintWorkspaceGrammar());
  const lines = ["# Grammar & style lint", "", `Found ${found.length} issue(s).`, ""];
  if (!found.length) {
    lines.push("No issues detected.");
  } else {
    for (const f of found.slice(0, 200)) {
      lines.push(`- ${f.file}:${f.line} — ${f.message} — \`${f.excerpt}\``);
    }
    if (found.length > 200) lines.push(`\n… and ${found.length - 200} more`);
  }
  return writeWorkspaceFile("compile/grammar-lint.md", lines.join("\n") + "\n");
}
