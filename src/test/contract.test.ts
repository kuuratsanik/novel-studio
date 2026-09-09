import { strict as assert } from "node:assert";
import test from "node:test";
import { SceneContract, contractPath, contractPrompt, contractReady } from "../core/contract";

function contract(over: Partial<SceneContract> = {}): SceneContract {
  return { goal: "g", conflict: "c", turn: "t", exit: "e", mustInclude: [], mustNot: [], ...over };
}

test("a contract missing any required field is not ready", () => {
  assert.ok(contractReady(contract()));
  for (const field of ["goal", "conflict", "turn", "exit"] as const) {
    assert.equal(contractReady(contract({ [field]: "" })), false, `${field} should be required`);
  }
});

test("maps a draft path to its contract path", () => {
  assert.equal(contractPath("drafts/ch01.md"), "drafts/contracts/ch01.json");
  assert.equal(contractPath("drafts/part1/ch02.md"), "drafts/contracts/part1/ch02.json");
});

test("renders optional constraint lines only when present", () => {
  assert.equal(contractPrompt(contract()).includes("Must include"), false);
  const withRules = contractPrompt(contract({ mustInclude: ["rain"], mustNot: ["flashback"] }));
  assert.match(withRules, /Must include: rain/);
  assert.match(withRules, /Must not: flashback/);
});
