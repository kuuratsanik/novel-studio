import * as vscode from "vscode";
import { KeyManager } from "./keyManager";
import { loadContract, contractReady, currentDraftRel } from "./contracts";

export class StudioStatusBar {
  private readonly item: vscode.StatusBarItem;
  private flags = 0;

  constructor(private readonly keys: KeyManager) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 80);
    this.item.command = "novelStudio.auditContinuity";
    this.item.show();
  }

  public get disposable(): vscode.Disposable {
    return this.item;
  }

  public setFlags(n: number) {
    this.flags = n;
    void this.refresh();
  }

  public async refresh() {
    const ed = vscode.window.activeTextEditor;
    const words = ed ? ed.document.getText().split(/\s+/).filter(Boolean).length : 0;
    let contract = "no-draft";
    const rel = currentDraftRel();
    if (rel) {
      const loaded = await loadContract(rel);
      contract = !loaded ? "contract?" : contractReady(loaded.contract) ? "contract✓" : "contract✗";
    }
    const cfg = vscode.workspace.getConfiguration("novelStudio");
    const provider = cfg.get<string>("defaultProvider") || "auto";
    this.item.text = `$(book) ${words}w · ${contract} · ${this.flags} flags · ${provider}`;
    this.item.tooltip = "Novel Studio status — click to audit continuity";
  }
}
