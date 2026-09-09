import * as vscode from "vscode";
import { rebuildEmbeddings } from "./embeddings";

let timer: ReturnType<typeof setTimeout> | undefined;
let running = false;

function shouldIndex(rel: string): boolean {
  return rel.startsWith("codex/") || rel.startsWith("drafts/") || rel.startsWith("research/");
}

export function scheduleEmbeddingRebuild(document: vscode.TextDocument): void {
  const cfg = vscode.workspace.getConfiguration("novelStudio");
  if (!cfg.get<boolean>("autoRebuildEmbeddings")) return;
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return;
  const rel = vscode.workspace.asRelativePath(document.uri).replace(/\\/g, "/");
  if (!shouldIndex(rel) || !rel.endsWith(".md")) return;

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void runRebuild(cfg.get<string>("localTextUrl") || "http://127.0.0.1:11434"), 8000);
}

async function runRebuild(localUrl: string): Promise<void> {
  if (running) return;
  running = true;
  try {
    const n = await rebuildEmbeddings(localUrl);
    if (n > 0) {
      vscode.window.setStatusBarMessage(`Novel Studio: refreshed ${n} embedding chunk(s)`, 4000);
    }
  } catch {
    // Ollama may be offline
  } finally {
    running = false;
  }
}
