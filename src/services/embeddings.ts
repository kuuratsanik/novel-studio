import * as vscode from "vscode";
import { cosineSimilarity } from "./proseStats";
import { listMarkdown, readWorkspaceFile, writeWorkspaceFile } from "./workspaceIo";

export interface EmbeddingChunk {
  id: string;
  path: string;
  text: string;
  vector: number[];
}

interface EmbeddingStore {
  model: string;
  updated: string;
  chunks: EmbeddingChunk[];
}

const STORE_PATH = ".novel-studio/embeddings.json";
const DEFAULT_MODEL = "nomic-embed-text";

function chunkText(rel: string, text: string): { id: string; path: string; text: string }[] {
  const paragraphs = text
    .replace(/^---[\s\S]*?---\n/, "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40);
  return paragraphs.slice(0, 40).map((p, i) => ({
    id: `${rel}#${i}`,
    path: rel,
    text: p.slice(0, 800),
  }));
}

async function embedOllama(text: string, localUrl: string, model: string): Promise<number[]> {
  const res = await fetch(`${localUrl.replace(/\/$/, "")}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: text }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}`);
  const data = (await res.json()) as { embedding?: number[] };
  if (!data.embedding?.length) throw new Error("empty embedding");
  return data.embedding;
}

async function embedChunks(
  rel: string,
  text: string,
  localUrl: string,
  model: string,
): Promise<EmbeddingChunk[]> {
  const chunks: EmbeddingChunk[] = [];
  for (const c of chunkText(rel, text)) {
    try {
      const vector = await embedOllama(c.text, localUrl, model);
      chunks.push({ ...c, vector });
    } catch {
      // skip when embedding endpoint unavailable
    }
  }
  return chunks;
}

async function loadStore(): Promise<EmbeddingStore | undefined> {
  try {
    return JSON.parse(await readWorkspaceFile(STORE_PATH)) as EmbeddingStore;
  } catch {
    return undefined;
  }
}

async function saveStore(store: EmbeddingStore): Promise<void> {
  store.updated = new Date().toISOString();
  await writeWorkspaceFile(STORE_PATH, JSON.stringify(store));
}

export async function rebuildEmbeddingsForPaths(
  paths: string[],
  localUrl = "http://127.0.0.1:11434",
): Promise<number> {
  const model =
    vscode.workspace.getConfiguration("novelStudio").get<string>("embeddingModel") || DEFAULT_MODEL;
  const unique = [...new Set(paths.filter((p) => p.endsWith(".md")))];
  if (!unique.length) return 0;

  const files = (await listMarkdown()).filter((f) => unique.includes(f.rel));
  const existing = (await loadStore()) || { model, updated: "", chunks: [] };
  const keep = existing.chunks.filter((c) => !unique.includes(c.path));
  const fresh: EmbeddingChunk[] = [];

  for (const file of files) {
    fresh.push(...(await embedChunks(file.rel, file.text, localUrl, model)));
  }

  const store: EmbeddingStore = { model, updated: "", chunks: [...keep, ...fresh] };
  await saveStore(store);
  return fresh.length;
}

export async function rebuildEmbeddings(localUrl = "http://127.0.0.1:11434"): Promise<number> {
  const files = (await listMarkdown()).filter(
    (f) => f.rel.startsWith("codex/") || f.rel.startsWith("drafts/") || f.rel.startsWith("research/"),
  );
  return rebuildEmbeddingsForPaths(files.map((f) => f.rel), localUrl);
}

export async function retrieveEmbeddingContext(
  query: string,
  localUrl: string,
  limit = 3,
): Promise<string> {
  const store = await loadStore();
  if (!store?.chunks.length) return "";

  const model =
    vscode.workspace.getConfiguration("novelStudio").get<string>("embeddingModel") || DEFAULT_MODEL;
  let qVec: number[];
  try {
    qVec = await embedOllama(query.slice(0, 1000), localUrl, model);
  } catch {
    return "";
  }

  const ranked = store.chunks
    .map((c) => ({ c, score: cosineSimilarity(qVec, c.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (!ranked.length || ranked[0].score < 0.2) return "";

  const parts = ranked.map(({ c, score }) => `Source ${c.path} (sim ${score.toFixed(2)}):\n${c.text}`);
  return `Embedding retrieval:\n${parts.join("\n\n")}`;
}
