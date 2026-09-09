import * as vscode from "vscode";
import { generatePacked, selection } from "../commands";
import { TextRouter } from "./textProviders";
import { KeyManager } from "./keyManager";
import { loadPrompt } from "./prompts";

export class ContinuityCodeActionProvider implements vscode.CodeActionProvider {
  constructor(private readonly text: TextRouter, private readonly keys: KeyManager) {}

  provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range,
    context: vscode.CodeActionContext,
  ): vscode.CodeAction[] {
    const actions: vscode.CodeAction[] = [];
    for (const diag of context.diagnostics) {
      if (diag.source !== "Novel Studio") continue;
      const fix = new vscode.CodeAction(`Fix: ${diag.message.slice(0, 48)}…`, vscode.CodeActionKind.QuickFix);
      fix.diagnostics = [diag];
      fix.command = {
        command: "novelStudio.fixContinuity",
        title: "Fix continuity issue",
        arguments: [diag.message, document.uri.toString(), range],
      };
      actions.push(fix);
    }
    return actions;
  }
}

export async function fixContinuityIssue(
  text: TextRouter,
  keys: KeyManager,
  message: string,
  uri: string,
  range: vscode.Range,
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri));
  const ed = await vscode.window.showTextDocument(doc);
  const snippet = doc.getText(range) || selection() || doc.getText().slice(-800);
  const sys = `${await loadPrompt("continuity")}\nFix only the flagged issue. Return corrected prose for the selection.`;
  const out = await generatePacked(text, keys, `Issue: ${message}\n\nProse:\n${snippet}`, sys, undefined, "fast");
  await ed.edit((b) => b.replace(range, out));
}
