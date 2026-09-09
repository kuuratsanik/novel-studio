import * as vscode from "vscode";
import { TextRouter } from "./services/textProviders";
import { KeyManager } from "./services/keyManager";
import { AudioService, TTS_CHAR_LIMIT } from "./services/audioService";
import { ContinuityDiagnostics } from "./services/diagnostics";
import { StudioStatusBar } from "./services/statusBar";
import { packContext } from "./services/contextPacker";
import { loadPrompt, listPrompts } from "./services/prompts";
import { logUsage } from "./services/usage";
import { REVISION_MODES, RevisionMode } from "./services/revisionModes";
import { diffSides, wordDiff } from "./services/diffUtil";

const LOCAL_PROVIDERS = ["ollama", "kobold", "oobabooga", "tabby"];

export function selection(): string {
  const ed = vscode.window.activeTextEditor;
  return ed ? ed.document.getText(ed.selection) : "";
}

export function activeText(): string {
  return vscode.window.activeTextEditor?.document.getText() || "";
}

export async function insert(text: string): Promise<void> {
  const ed = vscode.window.activeTextEditor;
  if (!ed) throw new Error("Open a Markdown file first.");
  const pos = ed.selection.active;
  const ok = await ed.edit((b) => b.insert(pos, `\n\n${text}\n\n`));
  if (!ok) throw new Error("The editor rejected the insert. Is the file read-only?");
}

export async function replaceSel(text: string): Promise<void> {
  const ed = vscode.window.activeTextEditor;
  if (!ed || ed.selection.isEmpty) throw new Error("Select text first.");
  const ok = await ed.edit((b) => b.replace(ed.selection, text));
  if (!ok) throw new Error("The editor rejected the replacement. Is the file read-only?");
}

export async function pickRoute(
  keys: KeyManager,
): Promise<{ provider: string; model: string; localUrl: string }> {
  const cfg = vscode.workspace.getConfiguration("novelStudio");
  const offline = cfg.get<boolean>("offlineFirst") ?? false;
  const forced = cfg.get<string>("defaultProvider") || "";
  const defaultModel = cfg.get<string>("defaultModel") || "";
  const localUrl = cfg.get<string>("localTextUrl") || "http://127.0.0.1:11434";
  if (forced && forced !== "auto") {
    return { provider: forced, model: defaultModel || "auto", localUrl };
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

/**
 * Runs one generation behind a cancellable progress notification so a slow or
 * unreachable engine never leaves the editor looking frozen.
 */
export async function generatePacked(
  text: TextRouter,
  keys: KeyManager,
  prompt: string,
  systemPrompt: string,
  title = "Novel Studio: generating",
): Promise<string> {
  const route = await pickRoute(keys);
  const privacy =
    vscode.workspace.getConfiguration("novelStudio").get<boolean>("privacyLocalCodex") ?? false;
  const cloud = !LOCAL_PROVIDERS.includes(route.provider);
  const shareCodex = !(privacy && cloud);

  const context = await packContext({
    prompt,
    selection: selection(),
    openText: activeText(),
    shareCodex,
    allowException: false,
  });

  const out = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `${title} (${route.provider})`,
      cancellable: true,
    },
    (_progress, token) =>
      text.generate({
        provider: route.provider,
        model: route.model,
        localUrl: route.localUrl,
        prompt,
        systemPrompt,
        context,
        token,
      }),
  );

  await logUsage({
    provider: route.provider,
    model: route.model,
    promptChars: prompt.length + context.length,
    outputChars: out.length,
  }).catch(() => undefined);
  return out;
}

export async function continueScene(text: TextRouter, keys: KeyManager) {
  const { loadContract, contractReady, seedContract, currentDraftRel } = await import(
    "./services/contracts"
  );
  const rel = currentDraftRel();
  if (rel) {
    const loaded = await loadContract(rel);
    if (!loaded) {
      const dest = await seedContract(rel);
      throw new Error(`Fill ${dest} before Continue.`);
    }
    if (!contractReady(loaded.contract)) {
      throw new Error("Scene contract is incomplete. Fill goal, conflict, turn, and exit.");
    }
  }
  const sys = await loadPrompt("continue");
  const prompt = selection() || activeText().slice(-1800) || "Open the next beat.";
  const out = await generatePacked(text, keys, prompt, sys, "Continuing scene");
  await insert(out);
  const { reviewAndApply } = await import("./services/statePatch");
  const msg = await reviewAndApply(out);
  if (msg && !msg.startsWith("No state")) vscode.window.showInformationMessage(msg);
}

export async function expandSelection(text: TextRouter, keys: KeyManager) {
  const src = selection();
  if (!src) throw new Error("Select a beat to expand.");
  const out = await generatePacked(text, keys, src, await loadPrompt("expand"), "Expanding beat");
  await insert(out);
}

export async function diffRewrite(text: TextRouter, keys: KeyManager) {
  const src = selection();
  if (!src) throw new Error("Select text to rewrite.");
  const out = await generatePacked(text, keys, src, await loadPrompt("rewrite"), "Rewriting");

  // Show the change in a real diff editor. A quick-pick title truncates at
  // roughly 80 characters, which is useless for reviewing prose.
  const { before, after } = diffSides(wordDiff(src, out));
  const left = await vscode.workspace.openTextDocument({ content: before, language: "markdown" });
  const right = await vscode.workspace.openTextDocument({ content: after, language: "markdown" });
  await vscode.commands.executeCommand(
    "vscode.diff",
    left.uri,
    right.uri,
    "Novel Studio: proposed rewrite",
    { preview: true },
  );

  const pick = await vscode.window.showQuickPick(["Apply rewrite", "Keep original"], {
    title: "Apply the proposed rewrite?",
  });
  if (pick === "Apply rewrite") await replaceSel(out);
}

export async function multiAgent(text: TextRouter, keys: KeyManager) {
  const src = selection() || activeText().slice(-2000);
  const draft = await generatePacked(
    text,
    keys,
    src,
    "Role: writer. Continue the scene.",
    "Multi-agent pass 1 of 2: writer",
  );
  const edited = await generatePacked(
    text,
    keys,
    draft,
    "Role: editor. Tighten only.",
    "Multi-agent pass 2 of 2: editor",
  );
  await insert(edited);
}

export async function runAudit(diagnostics: ContinuityDiagnostics, status?: StudioStatusBar) {
  const n = await diagnostics.runOnEditor();
  status?.setFlags(n);
  vscode.window.showInformationMessage(
    n === 0 ? "Continuity audit: no flags." : `Continuity flags: ${n} (see Problems)`,
  );
}

export async function compileAll() {
  const { compileManuscript } = await import("./services/compiler");
  vscode.window.showInformationMessage(`Compiled ${(await compileManuscript()).join(", ")}`);
}

export async function exportLora() {
  const { exportLoraJsonl } = await import("./services/loraExport");
  vscode.window.showInformationMessage(`Wrote ${await exportLoraJsonl()}`);
}

export async function batchAudiobook(audio: AudioService) {
  const src = selection() || activeText();
  const rel = await narrate(audio, src);
  await insert(`[narration](${rel})`);
}

export async function narrateChapter(audio: AudioService) {
  const rel = await narrate(audio, selection() || activeText());
  await insert(`[narration](${rel})`);
}

async function narrate(audio: AudioService, src: string): Promise<string> {
  if (src.trim().length > TTS_CHAR_LIMIT) {
    throw new Error(
      `Narration accepts ${TTS_CHAR_LIMIT} characters per request; this passage is ${src.trim().length}. Select a shorter passage.`,
    );
  }
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: "Novel Studio: narrating", cancellable: true },
    (_p, token) => audio.speak(src, "openai", undefined, token),
  );
}

export async function pickPromptAndRun(text: TextRouter, keys: KeyManager) {
  const pick = await vscode.window.showQuickPick(listPrompts(), { title: "Prompt" });
  if (!pick) return;
  const out = await generatePacked(
    text,
    keys,
    selection() || activeText().slice(-1200),
    await loadPrompt(pick),
    `Running prompt "${pick}"`,
  );
  await insert(out);
}

export async function seedStudioFiles() {
  const { ensurePromptLibrary } = await import("./services/prompts");
  const { ensureBeats } = await import("./services/beats");
  await ensurePromptLibrary(true);
  await ensureBeats(true);
  vscode.window.showInformationMessage("Seeded prompts/ and codex/beats.md");
}

export async function revisionPass(text: TextRouter, keys: KeyManager) {
  const mode = (await vscode.window.showQuickPick(Object.keys(REVISION_MODES), {
    title: "Revision mode",
  })) as RevisionMode | undefined;
  if (!mode) return;
  const src = selection() || activeText();
  const out = await generatePacked(text, keys, src, REVISION_MODES[mode], `Revising (${mode})`);
  await insert(`<!-- ${mode} -->\n${out}`);
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
  vscode.window.showInformationMessage(`Clipped to ${await clipResearch()}`);
}

export async function publishCmd() {
  const { publishPackage } = await import("./services/publish");
  vscode.window.showInformationMessage(await publishPackage());
}

export async function commentCmd() {
  const { addComment } = await import("./services/comments");
  const dest = await addComment();
  if (dest) vscode.window.showInformationMessage(`Comment appended to ${dest}`);
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
  if (title === undefined) return;
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
