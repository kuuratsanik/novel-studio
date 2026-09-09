import { proposeStatePatches } from "../core/state";
import { unknownNames } from "../core/names";
import { contractReady } from "../core/contract";
import { wordDiff } from "../core/diff";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

/**
 * In-editor smoke check for the `novelStudio.runUnitTests` command. The full
 * suite lives in `src/test/*.test.ts` and runs under `npm test`.
 */
export function runUnitTests(): string {
  const state = {
    updated: "",
    characters: [
      { name: "Iskra", location: "Dock", status: "alive", inventory: [], relationships: {}, facts: [] },
    ],
  };
  const patches = proposeStatePatches("Iskra walked in Harbor and picked up the lantern.", state);
  assert(patches.some((p) => p.field === "location" && p.to === "Harbor"), "location patch");
  assert(patches.some((p) => String(p.field) === "facts+" && p.to.includes("lantern")), "inventory patch");

  const bible = { names: ["Iskra"], headings: [], text: "" };
  assert(unknownNames("Marek grinned.", bible).includes("Marek"), "unknown name");
  assert(!unknownNames("Iskra grinned.", bible).includes("Iskra"), "known name");
  assert(!unknownNames("Then the rain came.", bible).includes("Then"), "sentence-initial noise");

  assert(!contractReady({ goal: "", conflict: "c", turn: "t", exit: "e", mustInclude: [], mustNot: [] }), "empty goal");
  assert(contractReady({ goal: "g", conflict: "c", turn: "t", exit: "e", mustInclude: [], mustNot: [] }), "ready");

  const hunks = wordDiff("a b", "a c");
  assert(hunks.some((h) => h.kind === "del" && h.text === "b"), "diff del");
  assert(hunks.some((h) => h.kind === "add" && h.text === "c"), "diff add");

  return "unit tests passed";
}
