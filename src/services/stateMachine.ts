import { listMarkdown, readWorkspaceFile, writeWorkspaceFile } from "./workspaceIo";
import { SeriesState } from "../core/state";

export { statePrompt, applyPatchesTo } from "../core/state";
export type { CharacterState, SeriesState, StatePatch } from "../core/state";

const PATH = "codex/state.json";

export async function loadState(): Promise<SeriesState> {
  try {
    return JSON.parse(await readWorkspaceFile(PATH)) as SeriesState;
  } catch {
    return { updated: new Date().toISOString(), characters: [] };
  }
}

export async function saveState(state: SeriesState): Promise<string> {
  state.updated = new Date().toISOString();
  return writeWorkspaceFile(PATH, JSON.stringify(state, null, 2) + "\n");
}

export async function seedStateFromCodex(): Promise<SeriesState> {
  const existing = await loadState();
  const files = (await listMarkdown()).filter((f) => f.rel.startsWith("codex/characters"));
  const names = new Set(existing.characters.map((c) => c.name.toLowerCase()));
  for (const file of files) {
    for (const m of file.text.matchAll(/^##\s+(.+)$/gm)) {
      const name = m[1].replace(/\s*\(.+\)$/, "").trim();
      if (name && !names.has(name.toLowerCase())) {
        existing.characters.push({
          name,
          location: "unknown",
          status: "alive",
          inventory: [],
          relationships: {},
          facts: [],
        });
        names.add(name.toLowerCase());
      }
    }
  }
  await saveState(existing);
  return existing;
}
