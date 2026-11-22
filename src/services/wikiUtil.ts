/** Pure wiki helpers (no vscode) — used by index, broken-link audit, and tests. */

export function wikiDefinitionsFromFiles(files: { rel: string; text: string }[]): Set<string> {
  const defined = new Set<string>();
  for (const file of files) {
    const stem = file.rel.replace(/^.*\//, "").replace(/\.md$/i, "");
    defined.add(stem.replace(/[_-]+/g, " ").toLowerCase());
    for (const m of file.text.matchAll(/^#{1,3}\s+(.+)$/gm)) {
      defined.add(m[1].trim().toLowerCase());
    }
  }
  return defined;
}

export function findBrokenWikiLinksInFiles(
  files: { rel: string; text: string }[],
  definitions?: Set<string>,
): { file: string; link: string }[] {
  const known = definitions ?? wikiDefinitionsFromFiles(files);
  const broken: { file: string; link: string }[] = [];
  for (const file of files) {
    for (const m of file.text.matchAll(/\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g)) {
      const title = m[1].trim();
      if (!known.has(title.toLowerCase())) {
        broken.push({ file: file.rel, link: title });
      }
    }
  }
  return broken;
}
