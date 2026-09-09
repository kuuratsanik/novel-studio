export interface CharacterState {
  name: string;
  location?: string;
  status?: string;
  inventory: string[];
  relationships: Record<string, string>;
  facts: string[];
}

export interface SeriesState {
  updated: string;
  characters: CharacterState[];
}

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
    const name = escapeRe(c.name);

    const loc = new RegExp(
      `\\b${name}\\b[^.\\n]{0,50}\\b(?:in|at)\\s+([A-Z][A-Za-z]+(?:\\s+[A-Z][A-Za-z]+)?)`,
      "g",
    );
    const m = loc.exec(prose);
    if (m && m[1] && m[1] !== c.location) {
      patches.push({ name: c.name, field: "location", from: c.location || "unknown", to: m[1] });
    }

    const died = new RegExp(`\\b${name}\\b[^.\\n]{0,40}\\b(died|was killed|was dead)\\b`, "i");
    if (died.test(prose) && c.status !== "dead") {
      patches.push({ name: c.name, field: "status", from: c.status || "alive", to: "dead" });
    }

    const took = new RegExp(
      `\\b${name}\\b[^.\\n]{0,40}\\b(?:picked up|took|grabbed)\\s+(?:the\\s+)?([a-z][a-z\\s]{2,20})`,
      "i",
    );
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

export function applyPatchesTo(state: SeriesState, patches: StatePatch[]): number {
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
  return patches.length;
}

export function statePrompt(state: SeriesState): string {
  if (!state.characters.length) {
    return "Series state is empty. Do not invent locations or injuries.";
  }
  const lines = state.characters.map((c) => {
    const rel =
      Object.entries(c.relationships)
        .map(([k, v]) => `${k}:${v}`)
        .join(", ") || "n/a";
    return `- ${c.name} @ ${c.location ?? "?"} [${c.status ?? "?"}] inv:${c.inventory.join("|") || "—"} rel:${rel}`;
  });
  return `Live series state (do not contradict):\n${lines.join("\n")}`;
}
