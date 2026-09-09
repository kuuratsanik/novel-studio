import * as vscode from "vscode";
import { loadState, saveState } from "./stateMachine";
import { StatePatch, applyPatchesTo, proposeStatePatches } from "../core/state";

export { proposeStatePatches } from "../core/state";
export type { StatePatch } from "../core/state";

export async function applyPatches(patches: StatePatch[]): Promise<number> {
  if (!patches.length) return 0;
  const state = await loadState();
  const n = applyPatchesTo(state, patches);
  await saveState(state);
  return n;
}

export async function reviewAndApply(prose: string): Promise<string> {
  const state = await loadState();
  const patches = proposeStatePatches(prose, state);
  if (!patches.length) return "No state patches proposed.";
  const items = patches.map((p) => `${p.name}: ${String(p.field)} ${p.from} → ${p.to}`);
  const pick = await vscode.window.showQuickPick(
    [{ label: "Apply all", description: items.join("; ") }, { label: "Skip" }],
    { title: "Series state updates from this scene" },
  );
  if (pick?.label !== "Apply all") return "State patches skipped.";
  const n = await applyPatches(patches);
  return `Applied ${n} state patch(es) to codex/state.json`;
}
