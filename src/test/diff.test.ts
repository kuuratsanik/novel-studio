import { strict as assert } from "node:assert";
import test from "node:test";
import { diffSides, formatDiff, wordDiff } from "../core/diff";

function words(n: number, prefix: string): string {
  return Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");
}

test("marks a substituted word as one delete plus one add", () => {
  const hunks = wordDiff("a b", "a c");
  assert.ok(hunks.some((h) => h.kind === "del" && h.text === "b"));
  assert.ok(hunks.some((h) => h.kind === "add" && h.text === "c"));
});

test("identical input produces no edits", () => {
  const hunks = wordDiff("the lantern guttered", "the lantern guttered");
  assert.equal(
    hunks.every((h) => h.kind === "eq"),
    true,
  );
});

test("reconstructs both sides losslessly", () => {
  const before = "Iskra stepped onto the wet dock and waited.";
  const after = "Iskra stepped onto the frozen dock, then waited.";
  const { before: l, after: r } = diffSides(wordDiff(before, after));
  assert.equal(l, before);
  assert.equal(r, after);
});

test("formats edits with inline markers", () => {
  assert.equal(formatDiff(wordDiff("a b", "a c")), "a [-b-]{+c+}");
});

test("empty inputs are handled in both directions", () => {
  assert.deepEqual(wordDiff("", ""), []);
  assert.ok(wordDiff("", "new text").every((h) => h.kind === "add"));
  assert.ok(wordDiff("old text", "").every((h) => h.kind === "del"));
});

// Regression: the previous implementation allocated a full (n+1)x(m+1) matrix,
// so diffing a chapter-sized selection exhausted the extension host heap.
test("diffs a chapter-sized rewrite without exhausting memory", () => {
  const before = words(12_000, "word");
  const after = words(12_000, "alt");
  const heapBefore = process.memoryUsage().heapUsed;
  const hunks = wordDiff(before, after);
  const grewMb = (process.memoryUsage().heapUsed - heapBefore) / 1024 / 1024;

  assert.ok(hunks.length > 0);
  assert.ok(
    grewMb < 300,
    `expected bounded memory growth, saw ${grewMb.toFixed(0)}MB`,
  );
  const { before: l, after: r } = diffSides(hunks);
  assert.equal(l, before);
  assert.equal(r, after);
});

test("keeps a long shared prefix and suffix as equal hunks", () => {
  const shared = words(5_000, "shared");
  const hunks = wordDiff(`${shared} before ${shared}`, `${shared} after ${shared}`);
  assert.ok(hunks.some((h) => h.kind === "del" && h.text === "before"));
  assert.ok(hunks.some((h) => h.kind === "add" && h.text === "after"));
});
