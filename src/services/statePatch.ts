import * as vscode from "vscode";
import { CharacterState, loadState, saveState, SeriesState } from "./stateMachine";

export interface StatePatch {
  name: string;
  field: keyof CharacterState | "facts+";
  from: string;
  to: string;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function proposeStatePatches(prose: string, state: SeriesState): StatePatch[] {
  const patches: StatePatch[] = [];
  for (const c of state.characters) {
    const loc = new RegExp(`\\b${escapeRe(c.name)}\\b[^.\\n]{0,50}\\b(?:in|at)\\s+([A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+)?)`, "g");
    const m = loc.exec(prose);
    if (m && m[1] && m[1] !== c.location) {
      patches.push({ name: c.name, field: "location", from: c.location || "unknown", to: m[1] });
    }
    if (new RegExp(`\\b${escapeRe(c.name)}\\b[^.\\n]{0,40}\\b(died|was killed|was dead)\\b`, "i").test(prose) && c.status !== "dead") {
      patches.push({ name: c.name, field: "status", from: c.status || "alive", to: "dead" });
    }
    const took = new RegExp(`\\b${escapeRe(c.name)}\\b[^.\\n]{0,40}\\b(?:picked up|took|grabbed)\\s+(?:the\\s+)?([a-z][a-z\\s]{2,20})`, "i");
    const item = took.exec(prose);
    if (item) {
      const thing = item[1].trim();
      if (!c.inventory.includes(thing)) {
        patches.push({ name: c.name, field: "facts+", from: c.inventory.join(", "), to: thing });
      }
    }
  }
  return patches;
}

export async function applyPatches(patches: StatePatch[]): Promise<number> {
  if (!patches.length) return 0;
  const state = await loadState();
  for (const p of patches) {
    const c = state.characters.find((x) => x.name === p.name);
    if (!c) continue;
    if (p.field === "facts+") {
      if (!c.inventory.includes(p.to)) c.inventory.push(p.to);
      c.facts.push(`acquired ${p.to}`);
    } else if (p.field === "location" || p.field === "status") {
      c[p.field] = p.to;
    }
  }
  await saveState(state);
  return patches.length;
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
