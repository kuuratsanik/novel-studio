import * as vscode from "vscode";
import { writeWorkspaceFile } from "./workspaceIo";

export async function addComment(): Promise<string> {
  const ed = vscode.window.activeTextEditor;
  const sel = ed?.document.getText(ed.selection) || "";
  const note = await vscode.window.showInputBox({ prompt: "Comment" });
  if (!note) return "";
  const dest = `compile/comments.md`;
  await writeWorkspaceFile(dest, `## ${new Date().toISOString()}\n\n> ${sel.slice(0, 200)}\n\n${note}\n`);
  return dest;
}
