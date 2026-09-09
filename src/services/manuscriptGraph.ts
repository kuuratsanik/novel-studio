import { listMarkdown, writeWorkspaceFile, readWorkspaceFile } from "./workspaceIo";
import { draftSortKey, parseFrontmatter } from "./frontmatter";
import { loadState } from "./stateMachine";

export interface GraphEntity {
  id: string;
  kind: "character" | "chapter" | "location";
  name: string;
  path?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  rel: "appears-in" | "located-at" | "ordered-before";
}

export interface ManuscriptGraph {
  updated: string;
  entities: GraphEntity[];
  edges: GraphEdge[];
}

const STORE = ".novel-studio/graph.json";

export async function buildManuscriptGraph(): Promise<ManuscriptGraph> {
  const entities: GraphEntity[] = [];
  const edges: GraphEdge[] = [];
  const state = await loadState();

  for (const c of state.characters) {
    entities.push({ id: `char:${c.name}`, kind: "character", name: c.name });
    if (c.location && c.location !== "unknown") {
      const locId = `loc:${c.location}`;
      if (!entities.find((e) => e.id === locId)) {
        entities.push({ id: locId, kind: "location", name: c.location });
      }
      edges.push({ from: `char:${c.name}`, to: locId, rel: "located-at" });
    }
  }

  const drafts = (await listMarkdown())
    .filter((f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"))
    .sort((a, b) => draftSortKey(a.rel, a.text) - draftSortKey(b.rel, b.text));

  let prevChapterId: string | undefined;
  for (const d of drafts) {
    const chId = `ch:${d.rel}`;
    const { meta } = parseFrontmatter(d.text);
    entities.push({ id: chId, kind: "chapter", name: meta.beat || d.rel.replace(/^drafts\//, ""), path: d.rel });
    if (prevChapterId) {
      edges.push({ from: prevChapterId, to: chId, rel: "ordered-before" });
    }
    prevChapterId = chId;

    for (const c of state.characters) {
      if (new RegExp(`\\b${c.name}\\b`).test(d.text)) {
        edges.push({ from: `char:${c.name}`, to: chId, rel: "appears-in" });
      }
    }
  }

  return { updated: new Date().toISOString(), entities, edges };
}

export async function saveManuscriptGraph(): Promise<string> {
  const graph = await buildManuscriptGraph();
  return writeWorkspaceFile(STORE, JSON.stringify(graph, null, 2) + "\n");
}

export async function loadManuscriptGraph(): Promise<ManuscriptGraph | undefined> {
  try {
    return JSON.parse(await readWorkspaceFile(STORE)) as ManuscriptGraph;
  } catch {
    return undefined;
  }
}
