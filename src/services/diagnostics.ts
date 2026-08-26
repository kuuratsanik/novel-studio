import * as vscode from "vscode";
import { auditProse } from "./continuity";

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
    const flags = await auditProse(ed.document.getText());
    const diags = flags.map((f) => {
      const d = new vscode.Diagnostic(new vscode.Range(0, 0, 0, 1), f.message, vscode.DiagnosticSeverity.Warning);
      d.source = "Novel Studio";
      return d;
    });
    this.collection.set(ed.document.uri, diags);
    return diags.length;
  }
}
