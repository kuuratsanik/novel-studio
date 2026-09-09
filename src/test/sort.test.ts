import { strict as assert } from "node:assert";
import test from "node:test";
import { naturalCompare } from "../core/sort";

// Regression: lexicographic sorting placed ch10 before ch2, so a compiled
// manuscript came out in the wrong chapter order.
test("orders embedded numbers numerically", () => {
  const files = ["drafts/ch10.md", "drafts/ch2.md", "drafts/ch1.md", "drafts/ch21.md"];
  assert.deepEqual(files.sort(naturalCompare), [
    "drafts/ch1.md",
    "drafts/ch2.md",
    "drafts/ch10.md",
    "drafts/ch21.md",
  ]);
});

test("keeps zero-padded names in order too", () => {
  const files = ["drafts/ch03.md", "drafts/ch01.md", "drafts/ch02.md"];
  assert.deepEqual(files.sort(naturalCompare), [
    "drafts/ch01.md",
    "drafts/ch02.md",
    "drafts/ch03.md",
  ]);
});

test("sorts nested parts before comparing chapter numbers", () => {
  const files = ["drafts/part2/ch1.md", "drafts/part1/ch10.md", "drafts/part1/ch2.md"];
  assert.deepEqual(files.sort(naturalCompare), [
    "drafts/part1/ch2.md",
    "drafts/part1/ch10.md",
    "drafts/part2/ch1.md",
  ]);
});

test("is a stable total order for equal input", () => {
  assert.equal(naturalCompare("ch1.md", "ch1.md"), 0);
});
