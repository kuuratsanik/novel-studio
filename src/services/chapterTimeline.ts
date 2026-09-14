import * as vscode from "vscode";
import { listMarkdown } from "./workspaceIo";
import { draftSortKey } from "./frontmatter";
import { uriFor } from "./workspaceIo";
import { wordCount } from "./proseStats";

export interface ChapterEntry {
  rel: string;
  title: string;
  words: number;
  order: number;
}

export async function listChapters(): Promise<ChapterEntry[]> {
  return (await listMarkdown())
    .filter((f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"))
    .map((f) => ({
      rel: f.rel,
      title: f.rel.replace(/^drafts\//, "").replace(/\.md$/, ""),
      words: wordCount(f.text),
      order: draftSortKey(f.rel, f.text),
    }))
    .sort((a, b) => a.order - b.order);
}

export async function openChapterTimeline(): Promise<void> {
  const chapters = await listChapters();
  if (!chapters.length) {
    vscode.window.showInformationMessage("No draft chapters found.");
    return;
  }
  const pick = await vscode.window.showQuickPick(
    chapters.map((c) => ({
      label: c.title,
      description: `${c.words} words`,
      detail: c.rel,
    })),
    { title: "Chapter timeline", matchOnDescription: true },
  );
  if (!pick?.detail) return;
  const doc = await vscode.workspace.openTextDocument(uriFor(pick.detail));
  await vscode.window.showTextDocument(doc);
}
