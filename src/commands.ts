import * as vscode from "vscode";
import { TextRouter } from "./services/textProviders";
import { KeyManager } from "./services/keyManager";
import { AudioService } from "./services/audioService";
import { ContinuityDiagnostics } from "./services/diagnostics";
import { packContext } from "./services/contextPacker";
import { loadPrompt, ensurePromptLibrary, listPrompts } from "./services/prompts";
import { logUsage } from "./services/usage";
import { REVISION_MODES, RevisionMode } from "./services/revisionModes";
import { formatDiff, wordDiff } from "./services/diffUtil";

export function selection(): string {
  const ed = vscode.window.activeTextEditor;
  return ed ? ed.document.getText(ed.selection) : "";
}

export function activeText(): string {
  return vscode.window.activeTextEditor?.document.getText() || "";
}

export function insert(text: string) {
  const ed = vscode.window.activeTextEditor;
  if (!ed) throw new Error("Open a Markdown file first.");
  const pos = ed.selection.active;
  void ed.edit((b) => b.insert(pos, `\n\n${text}\n\n`));
}

export function replaceSel(text: string) {
  const ed = vscode.window.activeTextEditor;
  if (!ed || ed.selection.isEmpty) throw new Error("Select text first.");
  void ed.edit((b) => b.replace(ed.selection, text));
}

export async function pickRoute(keys: KeyManager): Promise<{ provider: string; model: string; localUrl: string }> {
  const cfg = vscode.workspace.getConfiguration("novelStudio");
  const offline = cfg.get<boolean>("offlineFirst") ?? false;
  const forced = cfg.get<string>("defaultProvider") || "";
  const defaultModel = cfg.get<string>("defaultModel") || "";
  const localUrl = cfg.get<string>("localTextUrl") || "http://127.0.0.1:11434";
  if (forced && forced !== "auto") {
    return { provider: forced, model: defaultModel || (forced === "ollama" ? "llama3.1" : "auto"), localUrl };
  }
  const hasCloud =
    (await keys.hasKey("openrouter")) ||
    (await keys.hasKey("anthropic")) ||
    (await keys.hasKey("openai")) ||
    (await keys.hasKey("novelai"));
  if (offline || !hasCloud) {
    return { provider: "ollama", model: defaultModel || "llama3.1", localUrl };
  }
  if (await keys.hasKey("anthropic")) return { provider: "anthropic", model: defaultModel || "auto", localUrl };
  if (await keys.hasKey("openrouter")) return { provider: "openrouter", model: defaultModel || "auto", localUrl };
  if (await keys.hasKey("openai")) return { provider: "openai", model: defaultModel || "auto", localUrl };
  return { provider: "novelai", model: defaultModel || "kayra-v1", localUrl };
}

export async function generatePacked(text: TextRouter, keys: KeyManager, prompt: string, systemPrompt: string) {
  const route = await pickRoute(keys);
  const privacy = vscode.workspace.getConfiguration("novelStudio").get<boolean>("privacyLocalCodex") ?? false;
  const cloud = !["ollama", "kobold", "oobabooga", "tabby"].includes(route.provider);
  const context = await packContext({
    prompt,
    selection: selection(),
    openText: activeText(),
    useRag: !(privacy && cloud),
    useBible: !(privacy && cloud),
    useStyle: true,
    allowException: false,
    ollamaUrl: route.localUrl,
  });
  const out = await text.generate({
    provider: route.provider,
    model: route.model,
    localUrl: route.localUrl,
    prompt,
    systemPrompt,
    context,
  });
  await logUsage({
    provider: route.provider,
    model: route.model,
    promptChars: prompt.length + context.length,
    outputChars: out.length,
  }).catch(() => undefined);
  return out;
}

export async function continueScene(text: TextRouter, keys: KeyManager) {
  const { loadContract, contractReady, seedContract, currentDraftRel } = await import("./services/contracts");
  const rel = currentDraftRel();
  if (rel) {
    let loaded = await loadContract(rel);
    if (!loaded) {
      await seedContract(rel);
      throw new Error(`Fill drafts/contracts/${rel.replace(/^drafts\/|\.md$/g, "")}.json before Continue.`);
    }
    if (!contractReady(loaded.contract)) {
      throw new Error("Scene contract is incomplete. Fill goal, conflict, turn, and exit.");
    }
  }
  const sys = await loadPrompt("continue");
  const prompt = selection() || activeText().slice(-1800) || "Open the next beat.";
  const out = await generatePacked(text, keys, prompt, sys);
  insert(out);
  const { reviewAndApply } = await import("./services/statePatch");
  const msg = await reviewAndApply(out);
  if (msg && !msg.startsWith("No state")) vscode.window.showInformationMessage(msg);
}

export async function expandSelection(text: TextRouter, keys: KeyManager) {
  const src = selection();
  if (!src) throw new Error("Select a beat to expand.");
  const out = await generatePacked(text, keys, src, await loadPrompt("expand"));
  insert(out);
}

export async function diffRewrite(text: TextRouter, keys: KeyManager) {
  const src = selection();
  if (!src) throw new Error("Select text to rewrite.");
  const out = await generatePacked(text, keys, src, await loadPrompt("rewrite"));
  const shown = formatDiff(wordDiff(src, out));
  const pick = await vscode.window.showQuickPick(["Apply rewrite", "Keep original"], { title: shown.slice(0, 80) });
  if (pick === "Apply rewrite") replaceSel(out);
}

export async function multiAgent(text: TextRouter, keys: KeyManager) {
  const src = selection() || activeText().slice(-2000);
  const draft = await generatePacked(text, keys, src, "Role: writer. Continue the scene.");
  const edited = await generatePacked(text, keys, draft, "Role: editor. Tighten only.");
  insert(edited);
}

export async function runAudit(diagnostics: ContinuityDiagnostics) {
  const n = await diagnostics.runOnEditor();
  vscode.window.showInformationMessage(`Continuity flags: ${n}`);
}

export async function compileAll() {
  const { compileManuscript } = await import("./services/compiler");
  vscode.window.showInformationMessage((await compileManuscript()).join(", "));
}

export async function exportLora() {
  const { exportLoraJsonl } = await import("./services/loraExport");
  vscode.window.showInformationMessage(await exportLoraJsonl());
}

export async function batchAudiobook(audio: AudioService) {
  const src = selection() || activeText();
  const rel = await audio.speak(src.slice(0, 4000), "openai");
  insert(`[narration](${rel})`);
}

export async function pickPromptAndRun(text: TextRouter, keys: KeyManager) {
  const names = await listPrompts();
  const pick = await vscode.window.showQuickPick(names, { title: "Prompt" });
  if (!pick) return;
  const out = await generatePacked(text, keys, selection() || activeText().slice(-1200), await loadPrompt(pick));
  insert(out);
}

export async function seedStudioFiles() {
  await ensurePromptLibrary();
  const { ensureBeats } = await import("./services/beats");
  await ensureBeats();
}

export async function revisionPass(text: TextRouter, keys: KeyManager) {
  const mode = (await vscode.window.showQuickPick(Object.keys(REVISION_MODES))) as RevisionMode | undefined;
  if (!mode) return;
  const src = selection() || activeText();
  const out = await generatePacked(text, keys, src, REVISION_MODES[mode]);
  insert(`<!-- ${mode} -->\n${out}`);
}

export async function seedState() {
  const { seedStateFromCodex } = await import("./services/stateMachine");
  const state = await seedStateFromCodex();
  vscode.window.showInformationMessage(`State machine: ${state.characters.length} character(s)`);
}

export async function seedContractCmd() {
  const { seedContract } = await import("./services/contracts");
  vscode.window.showInformationMessage(`Contract: ${await seedContract()}`);
}

export async function buildVoices() {
  const { buildVoiceModels } = await import("./services/characterVoice");
  vscode.window.showInformationMessage(`Voice models: ${(await buildVoiceModels()).length}`);
}

export async function outlineSyncCmd() {
  const { syncOutlineToDrafts } = await import("./services/outlineSync");
  vscode.window.showInformationMessage(await syncOutlineToDrafts());
}

export async function analyticsCmd() {
  const { writeAnalytics } = await import("./services/analytics");
  await writeAnalytics();
  vscode.window.showInformationMessage("Wrote compile/analytics.md");
}

export async function snapshotCmd() {
  const { snapshotBranch } = await import("./services/branches");
  vscode.window.showInformationMessage(`Snapshot ${await snapshotBranch()}`);
}

export async function mergeCmd() {
  const { mergeBranch } = await import("./services/branches");
  const msg = await mergeBranch();
  if (msg) vscode.window.showInformationMessage(msg);
}

export async function researchCmd() {
  const { clipResearch } = await import("./services/research");
  vscode.window.showInformationMessage(await clipResearch());
}

export async function publishCmd() {
  const { publishPackage } = await import("./services/publish");
  vscode.window.showInformationMessage(await publishPackage());
}

export async function commentCmd() {
  const { addComment } = await import("./services/comments");
  vscode.window.showInformationMessage(await addComment());
}

export async function evalCmd() {
  const { runEval } = await import("./services/evalHarness");
  vscode.window.showInformationMessage((await runEval()).slice(0, 140));
}

export async function readAloudCmd() {
  const { readAloudReport } = await import("./services/readAloudQa");
  await readAloudReport();
  vscode.window.showInformationMessage("Wrote compile/read-aloud-qa.md");
}

export async function bootstrapCmd() {
  const title = await vscode.window.showInputBox({ prompt: "Novel title", value: "Untitled Novel" });
  const { bootstrapWorkspace } = await import("./services/bootstrap");
  vscode.window.showInformationMessage(await bootstrapWorkspace(title || "Untitled Novel"));
}

export async function importDocxCmd() {
  const { importDocx } = await import("./services/importDocx");
  const msg = await importDocx();
  if (msg) vscode.window.showInformationMessage(msg);
}

export async function archiveCmd() {
  const { archiveProject } = await import("./services/archive");
  vscode.window.showInformationMessage(`Archive: ${await archiveProject()}`);
}

export async function applyStateFromSelection() {
  const { reviewAndApply } = await import("./services/statePatch");
  vscode.window.showInformationMessage(await reviewAndApply(selection() || activeText()));
}

export async function runTestsCmd() {
  const { runUnitTests } = await import("./test/unit");
  vscode.window.showInformationMessage(runUnitTests());
}
