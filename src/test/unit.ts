import { proposeStatePatches } from "../services/statePatch";
import { unknownNames } from "../services/bible";
import { contractReady } from "../services/contracts";
import { wordDiff } from "../services/diffUtil";
import { DEFAULT_TEXT_MODELS, resolveTextModel } from "../services/modelDefaults";
import { inferSceneContract } from "../services/autoContract";
import { assembleToolPrompt, describeRoute } from "../services/studioHub";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

export function runUnitTests(): string {
  const state = {
    updated: "",
    characters: [{ name: "Iskra", location: "Dock", status: "alive", inventory: [], relationships: {}, facts: [] }],
  };
  const patches = proposeStatePatches("Iskra walked in Harbor and picked up the lantern.", state);
  assert(patches.some((p) => p.field === "location" && p.to === "Harbor"), "location patch");
  assert(patches.some((p) => String(p.field) === "facts+" && p.to.includes("lantern")), "inventory patch");

  const bible = { names: ["Iskra"], headings: [], text: "" };
  assert(unknownNames("Marek grinned.", bible).includes("Marek"), "unknown name");
  assert(!unknownNames("Iskra grinned.", bible).includes("Iskra"), "known name");

  assert(!contractReady({ goal: "", conflict: "c", turn: "t", exit: "e", mustInclude: [], mustNot: [] }), "empty goal");
  assert(contractReady({ goal: "g", conflict: "c", turn: "t", exit: "e", mustInclude: [], mustNot: [] }), "ready");

  const hunks = wordDiff("a b", "a c");
  assert(hunks.some((h) => h.kind === "del" && h.text === "b"), "diff del");
  assert(hunks.some((h) => h.kind === "add" && h.text === "c"), "diff add");

  assert(resolveTextModel("anthropic", "auto") === DEFAULT_TEXT_MODELS.anthropic, "anthropic default");
  assert(resolveTextModel("openai", "auto") === DEFAULT_TEXT_MODELS.openai, "openai default");
  assert(resolveTextModel("ollama", "auto") === DEFAULT_TEXT_MODELS.ollama, "ollama default");
  assert(resolveTextModel("novelai", "auto") === DEFAULT_TEXT_MODELS.novelai, "novelai default");
  assert(resolveTextModel("openai", "gpt-custom") === "gpt-custom", "explicit model");
  assert(!resolveTextModel("anthropic", "auto").includes("claude-sonnet-4"), "no legacy sonnet-4 default");

  const inferred = inferSceneContract("---\nbeat: Catalyst\n---\n\n# Chapter 2\n\nShe ran.");
  assert(contractReady(inferred), "auto contract ready");
  assert(inferred.goal.includes("Catalyst"), "auto contract goal");

  const prompt = assembleToolPrompt("storyGen", { goal: "Escape", chars: "Mara", ending: "Door slams" });
  assert(prompt.includes("Escape"), "tool prompt goal");
  assert(describeRoute("charGen", {}) === "codex/characters.md", "char route");

  return "unit tests passed";
}
