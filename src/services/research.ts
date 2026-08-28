import * as vscode from "vscode";
import { writeWorkspaceFile } from "./workspaceIo";

export async function clipResearch(): Promise<string> {
  const text = vscode.window.activeTextEditor?.document.getText(vscode.window.activeTextEditor.selection) || "";
  if (!text.trim()) throw new Error("Select text to clip into research/.");
  const dest = `research/clip-${Date.now()}.md`;
  await writeWorkspaceFile(dest, text.trim() + "\n");
  return dest;
}
