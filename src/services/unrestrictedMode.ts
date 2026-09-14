import * as vscode from "vscode";
import { LOCAL_TEXT_PROVIDERS } from "./modelDefaults";

export function isUnrestrictedOnly(): boolean {
  return vscode.workspace.getConfiguration("novelStudio").get<boolean>("unrestrictedOnly") ?? false;
}

export function isLocalProvider(provider: string): boolean {
  return LOCAL_TEXT_PROVIDERS.has(provider);
}

export function blockCloud(message = "Cloud providers disabled in unrestricted-only mode."): void {
  if (isUnrestrictedOnly()) {
    throw new Error(message);
  }
}

export async function applyUnrestrictedPreset(): Promise<string[]> {
  const cfg = vscode.workspace.getConfiguration("novelStudio");
  const target = vscode.ConfigurationTarget.Workspace;
  const updates: [string, unknown][] = [
    ["unrestrictedOnly", true],
    ["offlineFirst", true],
    ["privacyLocalCodex", true],
    ["defaultProvider", "ollama"],
    ["streamGeneration", true],
    ["embeddingRag", true],
    ["autoRebuildEmbeddings", true],
    ["crossChapterAudit", true],
    ["autoOrchestrateOnOpen", true],
    ["orchestrateOnSave", true],
    ["fastModel", "qwen2.5:7b-instruct"],
    ["writerModel", "qwen2.5:32b-instruct"],
    ["embeddingModel", "nomic-embed-text"],
    ["localTtsFirst", true],
    ["inlineCompletions", false],
  ];
  for (const [key, value] of updates) {
    await cfg.update(key, value, target);
  }
  return updates.map(([k]) => `novelStudio.${k}`);
}
