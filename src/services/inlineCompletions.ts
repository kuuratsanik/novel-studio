import * as vscode from "vscode";
import { TextRouter } from "./textProviders";
import { KeyManager } from "./keyManager";
import { resolveModelForTask } from "./modelDefaults";
import { probeLocalEngine } from "./automation";
import { isUnrestrictedOnly } from "./unrestrictedMode";
import { packContext } from "./contextPacker";

let lastRequest = 0;

export class NovelInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
  constructor(private readonly text: TextRouter, private readonly keys: KeyManager) {}

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    _context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const enabled = vscode.workspace.getConfiguration("novelStudio").get<boolean>("inlineCompletions") ?? false;
    if (!enabled || document.languageId !== "markdown" || token.isCancellationRequested) return undefined;

    const line = document.lineAt(position.line).text.slice(0, position.character);
    if (line.trim().length < 12) return undefined;

    const tail = document.getText(new vscode.Range(Math.max(0, position.line - 12), 0, position.line, position.character));
    if (tail.length < 40) return undefined;

    const now = Date.now();
    if (now - lastRequest < 800) return undefined;
    lastRequest = now;

    const cfg = vscode.workspace.getConfiguration("novelStudio");
    const localUrl = cfg.get<string>("localTextUrl") || "http://127.0.0.1:11434";
    if (isUnrestrictedOnly() && !(await probeLocalEngine(localUrl))) return undefined;

    const fast = cfg.get<string>("fastModel") || "qwen2.5:7b-instruct";
    const writer = cfg.get<string>("writerModel") || "qwen2.5:32b-instruct";
    const deep = cfg.get<string>("deepModel") || writer;
    const model = resolveModelForTask("ollama", "fast", fast, writer, deep);

    try {
      const context = await packContext({
        prompt: tail.slice(-400),
        selection: "",
        openText: document.getText().slice(-2000),
        useRag: cfg.get<boolean>("embeddingRag") ?? true,
        useBible: true,
        useStyle: true,
        allowException: false,
        ollamaUrl: localUrl,
      });

      const suggestion = await this.text.generate({
        provider: "ollama",
        model,
        localUrl,
        prompt: `Continue this fiction prose with one short sentence only. Do not repeat.\n\n${tail.slice(-600)}`,
        systemPrompt: "You complete the next phrase of literary fiction. Output only the continuation, no quotes.",
        context,
        task: "fast",
      });
      const insert = suggestion.trim().replace(/^["']|["']$/g, "");
      if (!insert || insert.length > 200) return undefined;
      return [new vscode.InlineCompletionItem(insert, new vscode.Range(position, position))];
    } catch {
      return undefined;
    }
  }
}
