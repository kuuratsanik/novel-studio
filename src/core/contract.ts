export interface SceneContract {
  goal: string;
  conflict: string;
  turn: string;
  exit: string;
  mustInclude: string[];
  mustNot: string[];
  complete?: boolean;
}

export function contractReady(c: SceneContract): boolean {
  return !!(c.goal && c.conflict && c.turn && c.exit);
}

export function contractPath(draftRel: string): string {
  const stem = draftRel.replace(/^drafts\//, "").replace(/\.md$/, "");
  return `drafts/contracts/${stem}.json`;
}

export function contractPrompt(c: SceneContract): string {
  return [
    `Scene contract:`,
    `Goal: ${c.goal}`,
    `Conflict: ${c.conflict}`,
    `Turn: ${c.turn}`,
    `Exit: ${c.exit}`,
    c.mustInclude.length ? `Must include: ${c.mustInclude.join("; ")}` : "",
    c.mustNot.length ? `Must not: ${c.mustNot.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export const BLANK_CONTRACT: SceneContract = {
  goal: "",
  conflict: "",
  turn: "",
  exit: "",
  mustInclude: [],
  mustNot: [],
  complete: false,
};
