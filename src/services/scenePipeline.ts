import * as vscode from "vscode";
import { TextRouter } from "./textProviders";
import { KeyManager } from "./keyManager";
import { ContinuityDiagnostics } from "./diagnostics";
import { ensureSceneContract } from "./autoContract";
import { currentDraftRel, contractReady, loadContract } from "./contracts";
import { generatePacked, activeText, selection } from "../commands";
import { loadPrompt } from "./prompts";
import { reviewAndApply } from "./statePatch";
import { automationSettings } from "./automation";
import { StreamInserter } from "./streamInserter";

export async function runScenePipeline(
  text: TextRouter,
  keys: KeyManager,
  diagnostics?: ContinuityDiagnostics,
): Promise<string> {
  const rel = currentDraftRel();
  if (!rel) throw new Error("Open a drafts/*.md chapter first.");

  const contract = await ensureSceneContract(rel);
  if (!contractReady(contract)) {
    throw new Error("Complete the scene contract before running the pipeline.");
  }

  const sys = await loadPrompt("continue");
  const prompt = selection() || activeText().slice(-1800) || "Continue the scene per contract.";
  const ed = vscode.window.activeTextEditor;
  const streamOn = vscode.workspace.getConfiguration("novelStudio").get<boolean>("streamGeneration") ?? true;

  let out: string;
  if (streamOn && ed) {
    const sink = new StreamInserter(ed);
    await sink.begin();
    out = await generatePacked(text, keys, prompt, sys, (chunk) => void sink.push(chunk), "writer");
    out = await sink.finish();
  } else {
    out = await generatePacked(text, keys, prompt, sys, undefined, "writer");
  }

  await reviewAndApply(out);
  const auto = automationSettings();
  if (auto.autoAuditOnSave && diagnostics) {
    await diagnostics.runOnEditor();
  }

  const flags = await diagnostics?.runOnEditor();
  return `Scene pipeline complete (${out.length} chars, ${flags ?? 0} continuity flag(s)).`;
}
