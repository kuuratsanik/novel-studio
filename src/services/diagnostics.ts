import * as vscode from "vscode";
import { auditProse } from "./continuity";

function locateFlag(document: vscode.TextDocument, text: string, matchText?: string): vscode.Range {
  if (!matchText) return new vscode.Range(0, 0, 0, 1);
  const idx = text.indexOf(matchText);
  if (idx < 0) return new vscode.Range(0, 0, 0, 1);
  const start = document.positionAt(idx);
  const end = document.positionAt(idx + matchText.length);
  return new vscode.Range(start, end);
}

export class ContinuityDiagnostics {
  private readonly collection = vscode.languages.createDiagnosticCollection("novelStudio");

  public get disposable(): vscode.Disposable {
    return this.collection;
  }

  public async runOnEditor(editor?: vscode.TextEditor): Promise<number> {
    const ed = editor || vscode.window.activeTextEditor;
    if (!ed || ed.document.languageId !== "markdown") {
      return 0;
    }
    const text = ed.document.getText();
    const flags = await auditProse(text);
    const diags = flags.map((f) => {
      const range = locateFlag(ed.document, text, f.matchText);
      const d = new vscode.Diagnostic(range, f.message, vscode.DiagnosticSeverity.Warning);
      d.source = "Novel Studio";
      return d;
    });
    this.collection.set(ed.document.uri, diags);
    return diags.length;
  }
}
