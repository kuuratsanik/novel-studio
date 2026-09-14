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

export async function lintWorkspaceGrammar(): Promise<GrammarFlag[]> {
  const studio = await loadStudioConfig();
  const flags: GrammarFlag[] = [];

  for (const file of await listMarkdown()) {
    if (!file.rel.startsWith("drafts/") && !file.rel.startsWith("codex/")) continue;
    const lines = file.text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith("#") || line.startsWith("---")) continue;

      for (const w of filterWordHits(line, studio.banned || [])) {
        flags.push({ file: file.rel, line: i + 1, message: `Banned word: ${w}`, excerpt: line.trim().slice(0, 80) });
      }
      if (/\s{2,}/.test(line) && !line.startsWith("    ")) {
        flags.push({ file: file.rel, line: i + 1, message: "Double spaces", excerpt: line.trim().slice(0, 80) });
      }
      if (/\bvery\s+very\b/i.test(line)) {
        flags.push({ file: file.rel, line: i + 1, message: "Weak intensifier repetition", excerpt: line.trim().slice(0, 80) });
      }
    }

    const useLt = vscode.workspace.getConfiguration("novelStudio").get<boolean>("languageToolLint") ?? false;
    if (useLt && file.rel.startsWith("drafts/")) {
      const body = file.text.replace(/^---[\s\S]*?---\n/, "").slice(0, 6000);
      const matches = await lintWithLanguageTool(body);
      for (const m of matches.slice(0, 15)) {
        const before = body.slice(0, m.offset);
        const line = before.split(/\r?\n/).length;
        flags.push({
          file: file.rel,
          line,
          message: `LanguageTool: ${m.message}`,
          excerpt: body.slice(m.offset, m.offset + m.length).slice(0, 80),
        });
      }
    }
  }

  return flags;
}

export async function writeGrammarReport(): Promise<string> {
  const flags = await lintWorkspaceGrammar();
  const lines = ["# Grammar & style lint", "", `Found ${flags.length} issue(s).`, ""];
  if (!flags.length) {
    lines.push("No issues detected.");
  } else {
    for (const f of flags.slice(0, 200)) {
      lines.push(`- ${f.file}:${f.line} — ${f.message} — \`${f.excerpt}\``);
    }
    if (flags.length > 200) lines.push(`\n… and ${flags.length - 200} more`);
  }
  return writeWorkspaceFile("compile/grammar-lint.md", lines.join("\n") + "\n");
}
