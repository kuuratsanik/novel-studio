import * as vscode from "vscode";
import { lintWorkspaceGrammar, GrammarFlag } from "./grammarLint";
import { lintWithLanguageTool } from "./languageToolLint";
import { currentDraftRel } from "./contracts";

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

    const rel = currentDraftRel();
    const text = ed.document.getText();
    const diags: vscode.Diagnostic[] = [];

    const workspaceFlags = (await lintWorkspaceGrammar()).filter((f) => !rel || f.file === rel);
    for (const f of workspaceFlags) {
      const line = Math.max(0, f.line - 1);
      const range = new vscode.Range(line, 0, line, ed.document.lineAt(line).text.length);
      const d = new vscode.Diagnostic(range, f.message, vscode.DiagnosticSeverity.Information);
      d.source = "Novel Studio Grammar";
      diags.push(d);
    }

    if (cfg.get<boolean>("languageToolLint")) {
      const lt = await lintWithLanguageTool(text.slice(0, 8000));
      for (const m of lt.slice(0, 20)) {
        const start = ed.document.positionAt(m.offset);
        const end = ed.document.positionAt(m.offset + m.length);
        const d = new vscode.Diagnostic(new vscode.Range(start, end), m.message, vscode.DiagnosticSeverity.Warning);
        d.source = "LanguageTool";
        diags.push(d);
      }
    }

    this.collection.set(ed.document.uri, diags);
    return diags.length;
  }

  public async runWorkspace(): Promise<GrammarFlag[]> {
    return lintWorkspaceGrammar();
  }
}
