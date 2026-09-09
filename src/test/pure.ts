import { wordDiff } from "../services/diffUtil";
import { DEFAULT_TEXT_MODELS, resolveTextModel } from "../services/modelDefaults";
import { auditContract } from "../services/contractAudit";
import { cosineSimilarity, filterWordHits, overlapScore, wordCount } from "../services/proseStats";
import { draftSortKey, parseFrontmatter } from "../services/frontmatter";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

export function runPureTests(): void {
  const hunks = wordDiff("a b", "a c");
  assert(hunks.some((h) => h.kind === "del" && h.text === "b"), "diff del");

  assert(resolveTextModel("anthropic", "auto") === DEFAULT_TEXT_MODELS.anthropic, "anthropic default");
  assert(resolveTextModel("openai", "gpt-custom") === "gpt-custom", "explicit model");

  const flags = auditContract("hello forbidden word", {
    goal: "g",
    conflict: "c",
    turn: "t",
    exit: "e",
    mustInclude: ["hello"],
    mustNot: ["forbidden"],
  });
  assert(flags.some((f) => f.message.includes("mustNot")), "mustNot flag");
  assert(!flags.some((f) => f.message.includes("mustInclude missing")), "mustInclude ok");

  assert(filterWordHits("suddenly she realized", ["suddenly"]).includes("suddenly"), "filter word");
  assert(wordCount("one two three") === 3, "word count");
  assert(overlapScore("the quick brown fox", "the quick red fox") > 0.3, "overlap");

  const { meta } = parseFrontmatter("---\norder: 3\n---\n\n# Hi");
  assert(meta.order === "3", "frontmatter");
  assert(draftSortKey("drafts/ch10.md", "---\norder: 2\n---\n") < draftSortKey("drafts/ch11.md", ""), "sort key");
  assert(cosineSimilarity([1, 0], [1, 0]) === 1, "cosine identical");
}

if (require.main === module) {
  runPureTests();
  console.log("pure tests passed");
}
