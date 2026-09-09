import { loadBible, bibleLockPrompt } from "./bible";
import { loadState, statePrompt } from "./stateMachine";
import { loadContract, contractPrompt, currentDraftRel } from "./contracts";
import * as vscode from "vscode";
import { buildWikiIndex } from "./wikiIndex";
import { listMarkdown } from "./workspaceIo";
import { retrieveEmbeddingContext } from "./embeddings";
import { loadVoiceModels } from "./characterVoice";
import { voicePromptForSpeakers } from "./voicePrompt";
import { overlapScore } from "./proseStats";

export async function packContext(opts: {
  prompt: string;
  selection: string;
  openText: string;
  useRag: boolean;
  useBible: boolean;
  useStyle: boolean;
  allowException: boolean;
  ollamaUrl: string;
  speakers?: string[];
}): Promise<string> {
  const chunks: string[] = [];
  if (opts.useRag) {
    const hybrid = await retrieveHybridContext(opts.prompt, opts.selection, opts.ollamaUrl, opts.speakers);
    if (hybrid) chunks.push(hybrid);
  }
  if (opts.useBible) {
    const bible = await loadBible();
    chunks.push(bibleLockPrompt(bible, opts.allowException));
    if (bible.text) chunks.push(bible.text.slice(0, 4000));
  }
  const state = await loadState();
  chunks.push(statePrompt(state));
  const rel = currentDraftRel();
  if (rel) {
    const loaded = await loadContract(rel);
    if (loaded) chunks.push(contractPrompt(loaded.contract));
  }
  const voices = await loadVoiceModels();
  if (voices.length) {
    const speakers = opts.speakers || [
      ...[...opts.prompt.matchAll(/\b([A-Z][a-z]+)\b/g)].map((m) => m[1]),
      ...[...opts.selection.matchAll(/\b([A-Z][a-z]+)\b/g)].map((m) => m[1]),
    ];
    const voiceChunk = voicePromptForSpeakers(speakers, voices);
    if (voiceChunk) chunks.push(voiceChunk);
  }
  if (opts.selection) chunks.push(`Selection:\n${opts.selection.slice(0, 2500)}`);
  else if (opts.openText) chunks.push(`Open draft (tail):\n${opts.openText.slice(-1800)}`);
  chunks.push(opts.prompt);
  return chunks.filter(Boolean).join("\n\n");
}

interface RagCandidate {
  path: string;
  title: string;
  text: string;
  keywordScore: number;
  embedScore: number;
}

async function retrieveHybridContext(
  prompt: string,
  selection: string,
  ollamaUrl: string,
  speakers?: string[],
): Promise<string> {
  const query = `${prompt} ${selection}`.trim();
  if (!query) return "";

  const queryLower = query.toLowerCase();
  const queryTokens = queryLower.split(/\s+/).filter((t) => t.length > 3);
  const { entries } = await buildWikiIndex();
  const files = await listMarkdown();
  const fileText = new Map(files.map((f) => [f.rel, f.text]));
  const byKey = new Map<string, RagCandidate>();

  for (const e of entries) {
    const title = e.title.toLowerCase();
    let keywordScore = queryTokens.filter((t) => title.includes(t) || queryLower.includes(title)).length;
    if (selection && title.length > 2 && selection.toLowerCase().includes(title)) keywordScore += 2;
    if (speakers?.some((s) => title.includes(s.toLowerCase()))) keywordScore += 3;
    if (keywordScore <= 0) continue;
    const text = (fileText.get(e.path) || "").slice(0, 1200);
    const key = `${e.path}::${e.title}`;
    byKey.set(key, { path: e.path, title: e.title, text, keywordScore, embedScore: 0 });
  }

  const embedded = await retrieveEmbeddingContext(query, ollamaUrl, 5).catch(() => "");
  for (const block of embedded.split(/\n\n+/)) {
    const m = block.match(/^Source ([^\s]+) \(sim ([0-9.]+)\):\n([\s\S]*)$/);
    if (!m) continue;
    const [, path, sim, text] = m;
    const key = `${path}::embed`;
    const existing = byKey.get(key);
    const embedScore = Number(sim);
    if (existing) {
      existing.embedScore = Math.max(existing.embedScore, embedScore);
    } else {
      byKey.set(key, { path, title: path, text, keywordScore: 0, embedScore });
    }
  }

  const ranked = [...byKey.values()]
    .map((c) => ({
      c,
      total: c.keywordScore * 2 + c.embedScore + overlapScore(query, c.text) * 0.5,
    }))
    .filter((x) => x.total > 0.15)
    .sort((a, b) => b.total - a.total)
    .slice(0, 4);

  if (!ranked.length) return "";

  const parts = ranked.map(({ c }) => `Source ${c.path} — ${c.title}:\n${c.text}`);
  return `Retrieved context (hybrid):\n${parts.join("\n\n")}`;
}
