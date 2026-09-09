import { listMarkdown, writeWorkspaceFile, readWorkspaceFile } from "./workspaceIo";
import { draftSortKey } from "./frontmatter";
import { markdownToHtmlBlocks, wikiTitleSet } from "./markdownHtml";
import { epubCss, EpubTheme } from "./epubThemes";
import * as vscode from "vscode";
import { loadStudioConfig } from "./studioConfig";

function stripForCompile(text: string): string {
  return text
    .replace(/^---[\s\S]*?---\n/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/^>\s.*$/gm, "")
    .trim();
}

export async function compileManuscript(): Promise<string[]> {
  const drafts = (await listMarkdown())
    .filter((f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"))
    .sort((a, b) => draftSortKey(a.rel, a.text) - draftSortKey(b.rel, b.text));

  const body = drafts.map((d) => stripForCompile(d.text)).filter(Boolean).join("\n\n---\n\n");
  const toc = drafts.map((d, i) => `${i + 1}. ${d.rel.replace(/^drafts\//, "").replace(/\.md$/, "")}`).join("\n");
  const md = await writeWorkspaceFile(
    "compile/manuscript.md",
    `# Manuscript\n\n## Table of contents\n\n${toc}\n\n---\n\n${body}\n`,
  );
  return [md];
}

export async function exportHtml(): Promise<string> {
  const drafts = (await listMarkdown())
    .filter((f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"))
    .sort((a, b) => draftSortKey(a.rel, a.text) - draftSortKey(b.rel, b.text));

  if (!drafts.length) throw new Error("No draft chapters to export.");

  const studio = await loadStudioConfig();
  const title = studio.title || "Manuscript";
  const theme = (vscode.workspace.getConfiguration("novelStudio").get<string>("epubTheme") || "serif") as EpubTheme;
  const wiki = await wikiTitleSet();

  const sections = drafts.map((d) => {
    const name = d.rel.replace(/^drafts\//, "").replace(/\.md$/, "");
    return `<section class="chapter"><h1>${name}</h1>\n${markdownToHtmlBlocks(d.text, wiki)}</section>`;
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>${title}</title>
  <style>${epubCss(theme)}</style>
</head>
<body>
  <header><h1>${title}</h1></header>
  ${sections.join("\n")}
</body>
</html>`;

  return writeWorkspaceFile("compile/manuscript.html", html);
}
