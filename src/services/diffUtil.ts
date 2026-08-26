export type Hunk = { kind: "eq" | "add" | "del"; text: string };

export function wordDiff(a: string, b: string): Hunk[] {
  const left = a.split(/(\s+)/);
  const right = b.split(/(\s+)/);
  const n = left.length;
  const m = right.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = left[i] === right[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const hunks: Hunk[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      hunks.push({ kind: "eq", text: left[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      hunks.push({ kind: "del", text: left[i] });
      i++;
    } else {
      hunks.push({ kind: "add", text: right[j] });
      j++;
    }
  }
  while (i < n) hunks.push({ kind: "del", text: left[i++] });
  while (j < m) hunks.push({ kind: "add", text: right[j++] });
  return hunks;
}

export function formatDiff(hunks: Hunk[]): string {
  return hunks
    .map((h) => (h.kind === "eq" ? h.text : h.kind === "del" ? `[-${h.text}-]` : `{+${h.text}+}`))
    .join("");
}
