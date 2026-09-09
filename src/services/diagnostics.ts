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
    const doc = ed.document;
    const flags = await auditProse(doc.getText());
    const diags = flags.map((f) => {
      const range =
        f.index === undefined
          ? new vscode.Range(0, 0, 0, 1)
          : new vscode.Range(
              doc.positionAt(f.index),
              doc.positionAt(f.index + (f.length ?? 1)),
            );
      const severity =
        f.severity === "information"
          ? vscode.DiagnosticSeverity.Information
          : vscode.DiagnosticSeverity.Warning;
      const d = new vscode.Diagnostic(range, f.message, severity);
      d.source = "Novel Studio";
      return d;
    });
    this.collection.set(doc.uri, diags);
    return diags.length;
  }
}
