import * as vscode from "vscode";

export class HeadingCodeLens implements vscode.CodeLensProvider {
  public provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (document.languageId !== "markdown") return [];
    const lenses: vscode.CodeLens[] = [];
    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      if (/^#{1,3}\s+/.test(line.text)) {
        const range = new vscode.Range(i, 0, i, line.text.length);
        lenses.push(new vscode.CodeLens(range, { title: "Continue scene", command: "novelStudio.continueScene" }));
        lenses.push(new vscode.CodeLens(range, { title: "Audit", command: "novelStudio.auditContinuity" }));
      }
    }
    return lenses;
  }
}
