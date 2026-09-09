import { strict as assert } from "node:assert";
import test from "node:test";
import { Bible, findUnknownNames, isStructuralHeading, unknownNames } from "../core/names";

const bible: Bible = { names: ["Iskra"], headings: [], text: "" };

test("flags a proper name that is not in the bible", () => {
  assert.ok(unknownNames("Marek grinned.", bible).includes("Marek"));
});

test("does not flag a name the bible already knows", () => {
  assert.ok(!unknownNames("Iskra grinned.", bible).includes("Iskra"));
});

// Regression: every sentence-initial word used to be reported as an unknown
// proper name, which buried real findings.
test("ignores ordinary words capitalized by sentence position", () => {
  const prose =
    "Iskra stepped onto the dock. Then the rain came. But she did not stop. " +
    "His lantern guttered. Later, Harbor Street lay empty. Nobody spoke.";
  const flagged = unknownNames(prose, bible);
  for (const noise of ["Then", "But", "His", "Later", "Nobody"]) {
    assert.ok(!flagged.includes(noise), `should not flag "${noise}", got ${flagged.join(", ")}`);
  }
  assert.deepEqual(flagged, ["Harbor Street"]);
});

test("still flags a capitalized common word used mid-sentence as a name", () => {
  assert.ok(unknownNames("She told Will to wait.", bible).includes("Will"));
});

test("strips a sentence-initial article from a multi-word name", () => {
  assert.deepEqual(unknownNames("The Sunken Vault swallowed the light.", bible), ["Sunken Vault"]);
});

test("ignores structural codex headings", () => {
  assert.deepEqual(unknownNames("Plot Ideas and World Lore.", bible), []);
  assert.ok(isStructuralHeading("Characters"));
  assert.ok(!isStructuralHeading("Iskra"));
});

test("deduplicates repeated mentions", () => {
  assert.deepEqual(unknownNames("Marek waved. Marek left. Marek returned.", bible), ["Marek"]);
});

// Regression: diagnostics used to report every flag at line 1 because the
// audit returned no positions.
test("reports the offset of each unknown name so diagnostics can point at it", () => {
  const prose = "Iskra waited. Then Marek arrived.";
  const matches = findUnknownNames(prose, bible);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].name, "Marek");
  assert.equal(
    prose.slice(matches[0].index, matches[0].index + matches[0].length),
    "Marek",
  );
});

test("reports every occurrence, while unknownNames deduplicates", () => {
  const prose = "Marek waved. Marek left.";
  assert.equal(findUnknownNames(prose, bible).length, 2);
  assert.deepEqual(unknownNames(prose, bible), ["Marek"]);
});

test("ignores headings, front matter, code fences and editor annotations", () => {
  const doc = [
    "---",
    "beat: Opening Image",
    "status: draft",
    "---",
    "",
    "# Chapter One",
    "",
    "<!-- structure pass -->",
    "",
    "Iskra waited.",
    "",
    "```",
    "Fenced Block Text",
    "```",
  ].join("\n");
  assert.deepEqual(unknownNames(doc, bible), []);
});
