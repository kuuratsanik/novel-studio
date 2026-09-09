/**
 * Compares paths so embedded numbers order numerically: ch2 before ch10.
 * Plain lexicographic order puts "ch10.md" ahead of "ch2.md", which silently
 * scrambles a compiled manuscript.
 */
export function naturalCompare(a: string, b: string): number {
  const split = (s: string) => s.match(/\d+|\D+/g) ?? [];
  const left = split(a.toLowerCase());
  const right = split(b.toLowerCase());
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    const l = left[i];
    const r = right[i];
    const bothNumeric = /^\d/.test(l) && /^\d/.test(r);
    if (bothNumeric) {
      const diff = Number(l) - Number(r);
      if (diff !== 0) return diff < 0 ? -1 : 1;
    } else if (l !== r) {
      return l < r ? -1 : 1;
    }
  }
  return left.length - right.length;
}
