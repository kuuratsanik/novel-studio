import * as vscode from "vscode";
import { lintWorkspaceGrammar } from "./grammarLint";
import { listMarkdown, uriFor } from "./workspaceIo";
import { lintWithLanguageTool } from "./languageToolLint";

export class GrammarDiagnostics {
  private readonly collection = vscode.languages.createDiagnosticCollection("novelStudioGrammar");

  public get disposable(): vscode.Disposable {
    return this.collection;
  }

  public async runOnEditor(editor?: vscode.TextEditor): Promise<number> {
    const cfg = vscode.workspace.getConfiguration("novelStudio");
    if (!cfg.get<boolean>("grammarDiagnostics")) return 0;

    const ed = editor || vscode.window.activeTextEditor;
    if (!ed || ed.document.languageId !== "markdown") return 0;

    const rel = vscode.workspace.asRelativePath(ed.document.uri);
    return this.publishForRel(rel, ed.document);
  }

  public async runOnAllDrafts(): Promise<number> {
    const cfg = vscode.workspace.getConfiguration("novelStudio");
    if (!cfg.get<boolean>("grammarDiagnostics") && !cfg.get<boolean>("languageToolLint")) {
      // still publish heuristic grammar flags from workspace lint
    }

    const drafts = (await listMarkdown()).filter(
      (f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"),
    );
    const flags = await lintWorkspaceGrammar();
    let total = 0;
    for (const d of drafts) {
      const doc = await vscode.workspace.openTextDocument(uriFor(d.rel));
      const fileFlags = flags.filter((f) => f.file === d.rel);
      const diags = fileFlags.map((f) => {
        const line = Math.max(0, Math.min(doc.lineCount - 1, f.line - 1));
        const range = new vscode.Range(line, 0, line, doc.lineAt(line).text.length);
        const diag = new vscode.Diagnostic(range, f.message, vscode.DiagnosticSeverity.Information);
        diag.source = "Novel Studio Grammar";
        return diag;
      });
      this.collection.set(doc.uri, diags);
      total += diags.length;
    }
    return total;
  }

  private async publishForRel(rel: string, doc: vscode.TextDocument): Promise<number> {
    const flags = (await lintWorkspaceGrammar()).filter((f) => f.file === rel);
    const diags: vscode.Diagnostic[] = flags.map((f) => {
      const line = Math.max(0, Math.min(doc.lineCount - 1, f.line - 1));
      const range = new vscode.Range(line, 0, line, doc.lineAt(line).text.length);
      const d = new vscode.Diagnostic(range, f.message, vscode.DiagnosticSeverity.Information);
      d.source = "Novel Studio Grammar";
      return d;
    });

    const cfg = vscode.workspace.getConfiguration("novelStudio");
    if (cfg.get<boolean>("languageToolLint")) {
      const lt = await lintWithLanguageTool(doc.getText().slice(0, 8000));
      for (const m of lt.slice(0, 20)) {
        const start = doc.positionAt(m.offset);
        const end = doc.positionAt(m.offset + m.length);
        const d = new vscode.Diagnostic(new vscode.Range(start, end), m.message, vscode.DiagnosticSeverity.Warning);
        d.source = "LanguageTool";
        diags.push(d);
      }
    }

    this.collection.set(doc.uri, diags);
    return diags.length;
  }
}
