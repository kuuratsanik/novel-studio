import * as vscode from "vscode";

export class StreamInserter {
  private buffer = "";
  private start!: vscode.Position;

  constructor(private readonly editor: vscode.TextEditor) {}

  async begin(): Promise<void> {
    const pos = this.editor.selection.active;
    await this.editor.edit((b) => b.insert(pos, "\n\n"));
    this.start = pos.translate(0, 2);
    this.buffer = "";
  }

  async push(chunk: string): Promise<void> {
    if (!chunk) return;
    this.buffer += chunk;
    const end = this.editor.document.positionAt(this.editor.document.offsetAt(this.start) + this.buffer.length);
    await this.editor.edit((b) => b.replace(new vscode.Range(this.start, end), this.buffer));
  }

  async finish(): Promise<string> {
    const tail = this.editor.document.positionAt(this.editor.document.offsetAt(this.start) + this.buffer.length);
    await this.editor.edit((b) => b.insert(tail, "\n\n"));
    return this.buffer.trim();
  }
}
