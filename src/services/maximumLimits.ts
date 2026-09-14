import * as vscode from "vscode";
import { applyUnrestrictedPreset } from "./unrestrictedMode";

/** 2026–2027 absolute maximum limits preset — local-first, all automation on. */
export async function applyMaximumLimitsPreset(): Promise<string[]> {
  const unrestricted = await applyUnrestrictedPreset();
  const cfg = vscode.workspace.getConfiguration("novelStudio");
  const target = vscode.ConfigurationTarget.Workspace;
  const updates: [string, unknown][] = [
    ["inlineCompletions", true],
    ["deepPipeline", true],
    ["grammarDiagnostics", true],
    ["languageToolLint", true],
    ["sessionAnalytics", true],
    ["autoOrchestrateOnOpen", true],
    ["orchestrateOnSave", true],
    ["crossChapterAudit", true],
    ["embeddingRag", true],
    ["autoRebuildEmbeddings", true],
    ["contractGate", true],
    ["streamGeneration", true],
    ["maxTokens", 2048],
    ["deepModel", "qwen2.5:32b-instruct"],
  ];
  for (const [key, value] of updates) {
    await cfg.update(key, value, target);
  }
  return [...unrestricted, ...updates.map(([k]) => `novelStudio.${k}`)];
}

export function isMaximumLimitsMode(): boolean {
  const cfg = vscode.workspace.getConfiguration("novelStudio");
  return (
    (cfg.get<boolean>("unrestrictedOnly") ?? false) &&
    (cfg.get<boolean>("inlineCompletions") ?? false) &&
    (cfg.get<boolean>("deepPipeline") ?? false)
  );
}
