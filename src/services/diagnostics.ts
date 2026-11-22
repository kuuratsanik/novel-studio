import * as vscode from "vscode";
import { auditProse } from "./continuity";
import { listMarkdown } from "./workspaceIo";
import { uriFor } from "./workspaceIo";

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
    const rel = vscode.workspace.asRelativePath(ed.document.uri);
    const draftRel = rel.startsWith("drafts/") ? rel : undefined;
    return this.publishDiagnostics(ed.document.uri, text, draftRel);
  }

  public async publishDiagnostics(uri: vscode.Uri, text: string, draftRel?: string): Promise<number> {
    const flags = await auditProse(text, draftRel);
    const doc = await vscode.workspace.openTextDocument(uri);
    const diags = flags.map((f) => {
      const range = locateFlag(doc, text, f.matchText);
      const sev =
        f.severity === "warning" ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information;
      const d = new vscode.Diagnostic(range, f.message, sev);
      d.source = "Novel Studio";
      return d;
    });
    this.collection.set(uri, diags);
    return diags.length;
  }

  public async runOnAllDrafts(): Promise<number> {
    const drafts = (await listMarkdown()).filter(
      (f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"),
    );
    let total = 0;
    for (const d of drafts) {
      total += await this.publishDiagnostics(uriFor(d.rel), d.text, d.rel);
    }
    return total;
  }
}
