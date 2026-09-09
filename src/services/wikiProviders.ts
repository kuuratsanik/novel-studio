import * as vscode from "vscode";
import { buildWikiIndex } from "./wikiIndex";

let cachedTitles: string[] = [];
let cacheTime = 0;

async function titles(): Promise<string[]> {
  if (Date.now() - cacheTime < 30_000 && cachedTitles.length) return cachedTitles;
  const { entries } = await buildWikiIndex();
  cachedTitles = entries.map((e) => e.title);
  cacheTime = Date.now();
  return cachedTitles;
}

export class WikiLinkCompletionProvider implements vscode.CompletionItemProvider {
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.CompletionItem[]> {
    const line = document.lineAt(position).text.slice(0, position.character);
    const open = line.lastIndexOf("[[");
    if (open < 0) return [];
    const partial = line.slice(open + 2).toLowerCase();
    const all = await titles();
    return all
      .filter((t) => t.toLowerCase().includes(partial))
      .slice(0, 25)
      .map((t) => {
        const item = new vscode.CompletionItem(t, vscode.CompletionItemKind.Reference);
        item.insertText = partial ? t : `${t}]]`;
        item.range = new vscode.Range(position.line, open + 2, position.line, position.character);
        return item;
      });
  }
}

export class WikiLinkHoverProvider implements vscode.HoverProvider {
  async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
    const range = document.getWordRangeAtPosition(position, /\[\[[^\]]+\]\]/);
    if (!range) return undefined;
    const word = document.getText(range);
    const m = word.match(/\[\[([^\]|#]+)/);
    if (!m) return undefined;
    const { entries } = await buildWikiIndex();
    const hit = entries.find((e) => e.title.toLowerCase() === m[1].trim().toLowerCase());
    if (!hit) return new vscode.Hover(`Unknown wiki link: ${m[1]}`, range);
    return new vscode.Hover(`**${hit.title}** — \`${hit.path}\` (${hit.mentions} mentions)`, range);
  }
}
