import { proposeStatePatches } from "../services/statePatch";
import { unknownNames } from "../services/bible";
import { contractReady } from "../services/contracts";
import { wordDiff } from "../services/diffUtil";
import { isAllowedToolUrl } from "../services/toolUrls";
import { resolveLocalUrl, LOCAL_ENGINE_DEFAULTS, isLocalProvider } from "../services/localEngines";

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

  assert(isAllowedToolUrl("https://toolsaday.com/writing/story-generator"), "allow toolsaday https");
  assert(isAllowedToolUrl("https://www.toolsaday.com/writing/character-generator"), "allow www toolsaday");
  assert(!isAllowedToolUrl("http://toolsaday.com/writing/story-generator"), "block http");
  assert(!isAllowedToolUrl("https://evil.example/toolsaday.com"), "block other host");
  assert(!isAllowedToolUrl("javascript:alert(1)"), "block javascript url");

  assert(resolveLocalUrl("kobold", LOCAL_ENGINE_DEFAULTS.ollama) === LOCAL_ENGINE_DEFAULTS.kobold, "kobold default port");
  assert(resolveLocalUrl("oobabooga", LOCAL_ENGINE_DEFAULTS.ollama) === LOCAL_ENGINE_DEFAULTS.oobabooga, "oobabooga default port");
  assert(resolveLocalUrl("tabby", "http://127.0.0.1:9999") === "http://127.0.0.1:9999", "keep custom local url");
  assert(isLocalProvider("ollama") && isLocalProvider("tabby") && !isLocalProvider("openai"), "local provider set");

  return "unit tests passed";
}
