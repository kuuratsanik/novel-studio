export type Hunk = { kind: "eq" | "add" | "del"; text: string };

/**
 * Token-pair budget for the alignment step. Hirschberg needs O(min(n,m)) memory
 * but still O(n*m) time, so this bounds latency rather than memory. Selections
 * above the budget are aligned on paragraphs instead of words.
 */
const ALIGNMENT_BUDGET = 4_000_000;

function tokenizeWords(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

function tokenizeParagraphs(text: string): string[] {
  return text.split(/(\n\s*\n)/).filter((t) => t.length > 0);
}

/** Last row of the LCS length matrix, using two rolling rows. */
function lcsLastRow(a: string[], b: string[]): number[] {
  let prev = new Array<number>(b.length + 1).fill(0);
  let curr = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = 0;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev;
}

function emitAll(tokens: string[], kind: "add" | "del", out: Hunk[]): void {
  for (const text of tokens) out.push({ kind, text });
}

/** Hirschberg divide-and-conquer alignment; linear in memory. */
function align(a: string[], b: string[], out: Hunk[]): void {
  if (a.length === 0) {
    emitAll(b, "add", out);
    return;
  }
  if (b.length === 0) {
    emitAll(a, "del", out);
    return;
  }
  if (a.length === 1) {
    const at = b.indexOf(a[0]);
    if (at === -1) {
      out.push({ kind: "del", text: a[0] });
      emitAll(b, "add", out);
      return;
    }
    emitAll(b.slice(0, at), "add", out);
    out.push({ kind: "eq", text: a[0] });
    emitAll(b.slice(at + 1), "add", out);
    return;
  }

  const mid = a.length >> 1;
  const head = lcsLastRow(a.slice(0, mid), b);
  const tail = lcsLastRow(a.slice(mid).reverse(), b.slice().reverse());
  let bestScore = -1;
  let split = 0;
  for (let j = 0; j <= b.length; j++) {
    const score = head[j] + tail[b.length - j];
    if (score > bestScore) {
      bestScore = score;
      split = j;
    }
  }

  align(a.slice(0, mid), b.slice(0, split), out);
  align(a.slice(mid), b.slice(split), out);
}

export function wordDiff(a: string, b: string): Hunk[] {
  let left = tokenizeWords(a);
  let right = tokenizeWords(b);

  // Rewrites usually share their opening and closing runs verbatim. Peeling
  // those off first is what keeps the quadratic step off full-chapter input.
  const head: Hunk[] = [];
  let start = 0;
  while (start < left.length && start < right.length && left[start] === right[start]) {
    head.push({ kind: "eq", text: left[start] });
    start++;
  }
  const tail: Hunk[] = [];
  let endL = left.length;
  let endR = right.length;
  while (endL > start && endR > start && left[endL - 1] === right[endR - 1]) {
    tail.unshift({ kind: "eq", text: left[endL - 1] });
    endL--;
    endR--;
  }
  left = left.slice(start, endL);
  right = right.slice(start, endR);

  if (left.length * right.length > ALIGNMENT_BUDGET) {
    // Still too large to align word by word: fall back to paragraph
    // granularity so the command stays responsive instead of exhausting the
    // extension host.
    const coarseL = tokenizeParagraphs(left.join(""));
    const coarseR = tokenizeParagraphs(right.join(""));
    const coarse: Hunk[] = [];
    if (coarseL.length * coarseR.length <= ALIGNMENT_BUDGET) {
      align(coarseL, coarseR, coarse);
    } else {
      emitAll(coarseL, "del", coarse);
      emitAll(coarseR, "add", coarse);
    }
    return [...head, ...coarse, ...tail];
  }

  const middle: Hunk[] = [];
  align(left, right, middle);
  return [...head, ...middle, ...tail];
}

export function formatDiff(hunks: Hunk[]): string {
  return hunks
    .map((h) => (h.kind === "eq" ? h.text : h.kind === "del" ? `[-${h.text}-]` : `{+${h.text}+}`))
    .join("");
}

/** Rendered as two sides so the result can be shown in a real diff editor. */
export function diffSides(hunks: Hunk[]): { before: string; after: string } {
  let before = "";
  let after = "";
  for (const h of hunks) {
    if (h.kind === "eq") {
      before += h.text;
      after += h.text;
    } else if (h.kind === "del") {
      before += h.text;
    } else {
      after += h.text;
    }
  }
  return { before, after };
}
