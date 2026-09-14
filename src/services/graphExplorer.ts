import { loadManuscriptGraph, ManuscriptGraph, GraphEntity } from "./manuscriptGraph";

export interface GraphSummary {
  characters: GraphEntity[];
  chapters: GraphEntity[];
  locations: GraphEntity[];
  edgeCount: number;
  orphanCharacters: string[];
  updated?: string;
}

export async function summarizeGraph(): Promise<GraphSummary> {
  const graph = (await loadManuscriptGraph()) || { updated: "", entities: [], edges: [] };
  const characters = graph.entities.filter((e) => e.kind === "character");
  const chapters = graph.entities.filter((e) => e.kind === "chapter");
  const locations = graph.entities.filter((e) => e.kind === "location");

  const orphanCharacters = characters
    .filter((c) => !graph.edges.some((e) => e.from === c.id && e.rel === "appears-in"))
    .map((c) => c.name);

  return {
    characters,
    chapters,
    locations,
    edgeCount: graph.edges.length,
    orphanCharacters,
    updated: graph.updated,
  };
}

export function graphToMarkdown(summary: GraphSummary): string {
  const lines = [
    "# Manuscript graph",
    "",
    summary.updated ? `Updated: ${summary.updated}` : "",
    "",
    `| Kind | Count |`,
    `|---|---:|`,
    `| Characters | ${summary.characters.length} |`,
    `| Chapters | ${summary.chapters.length} |`,
    `| Locations | ${summary.locations.length} |`,
    `| Edges | ${summary.edgeCount} |`,
    "",
  ];

  if (summary.orphanCharacters.length) {
    lines.push("## Orphan characters (never appear in a chapter)", "");
    for (const n of summary.orphanCharacters) lines.push(`- ${n}`);
    lines.push("");
  }

  lines.push("## Chapters", "");
  for (const ch of summary.chapters) {
    lines.push(`- ${ch.name}${ch.path ? ` (\`${ch.path}\`)` : ""}`);
  }

  return lines.join("\n") + "\n";
}
