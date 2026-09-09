import { loadBible, bibleLockPrompt } from "./bible";
import { loadState, statePrompt } from "./stateMachine";
import { loadContract, contractPrompt, currentDraftRel } from "./contracts";

export interface PackOptions {
  prompt: string;
  selection: string;
  openText: string;
  /**
   * Whether locally authored codex material — the series bible and the
   * character state machine — may be included. Callers set this to false for
   * a cloud provider when `novelStudio.privacyLocalCodex` is on.
   */
  shareCodex: boolean;
  allowException: boolean;
}

export async function packContext(opts: PackOptions): Promise<string> {
  const chunks: string[] = [];

  if (opts.shareCodex) {
    const bible = await loadBible();
    chunks.push(bibleLockPrompt(bible, opts.allowException));
    if (bible.text) chunks.push(bible.text.slice(0, 4000));

    const state = await loadState();
    chunks.push(statePrompt(state));
  }

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
