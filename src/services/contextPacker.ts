import { loadBible, bibleLockPrompt } from "./bible";
import { loadState, statePrompt } from "./stateMachine";
import { loadContract, contractPrompt, currentDraftRel } from "./contracts";
import { buildWikiIndex } from "./wikiIndex";
import { listMarkdown } from "./workspaceIo";

export async function packContext(opts: {
  prompt: string;
  selection: string;
  openText: string;
  useRag: boolean;
  useBible: boolean;
  useStyle: boolean;
  allowException: boolean;
  ollamaUrl: string;
}): Promise<string> {
  const chunks: string[] = [];
  if (opts.useRag) {
    chunks.push(await retrieveRagContext(opts.prompt, opts.selection));
  }
  if (opts.useBible) {
    const bible = await loadBible();
    chunks.push(bibleLockPrompt(bible, opts.allowException));
    if (bible.text) chunks.push(bible.text.slice(0, 4000));
  }
  const state = await loadState();
  chunks.push(statePrompt(state));
  const rel = currentDraftRel();
  if (rel) {
    const loaded = await loadContract(rel);
    if (loaded) chunks.push(contractPrompt(loaded.contract));
  }
  if (opts.selection) chunks.push(`Selection:\n${opts.selection.slice(0, 2500)}`);
  else if (opts.openText) chunks.push(`Open draft (tail):\n${opts.openText.slice(-1800)}`);
  chunks.push(opts.prompt);
  return chunks.filter(Boolean).join("\n\n");
}

async function retrieveRagContext(prompt: string, selection: string): Promise<string> {
  const query = `${prompt} ${selection}`.toLowerCase();
  const queryTokens = query.split(/\s+/).filter((t) => t.length > 3);
  if (!queryTokens.length) return "";

  const { entries } = await buildWikiIndex();
  const files = await listMarkdown();
  const fileText = new Map(files.map((f) => [f.rel, f.text]));

  const scored = entries
    .map((e) => {
      const title = e.title.toLowerCase();
      let score = queryTokens.filter((t) => title.includes(t) || query.includes(title)).length;
      if (selection && title.length > 2 && selection.toLowerCase().includes(title)) score += 2;
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  if (!scored.length) return "";

  const parts = scored.map(({ e }) => {
    const text = fileText.get(e.path) || "";
    const chunk = text.slice(0, 1200);
    return `Source ${e.path} — ${e.title}:\n${chunk}`;
  });
  return `Retrieved context:\n${parts.join("\n\n")}`;
}
