import { wordDiff } from "../services/diffUtil";
import { DEFAULT_TEXT_MODELS, resolveTextModel } from "../services/modelDefaults";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

export function runPureTests(): void {
  const hunks = wordDiff("a b", "a c");
  assert(hunks.some((h) => h.kind === "del" && h.text === "b"), "diff del");
  assert(hunks.some((h) => h.kind === "add" && h.text === "c"), "diff add");

  assert(resolveTextModel("anthropic", "auto") === DEFAULT_TEXT_MODELS.anthropic, "anthropic default");
  assert(resolveTextModel("openai", "auto") === DEFAULT_TEXT_MODELS.openai, "openai default");
  assert(resolveTextModel("ollama", "auto") === DEFAULT_TEXT_MODELS.ollama, "ollama default");
  assert(resolveTextModel("novelai", "auto") === DEFAULT_TEXT_MODELS.novelai, "novelai default");
  assert(resolveTextModel("openai", "gpt-custom") === "gpt-custom", "explicit model");
  assert(!resolveTextModel("anthropic", "auto").includes("claude-sonnet-4"), "no legacy default");
}

if (require.main === module) {
  runPureTests();
  console.log("pure tests passed");
}
