import * as vscode from "vscode";
import { NovelStudioProvider } from "./NovelStudioProvider";
import { KeyManager, SECRET_SERVICES } from "./services/keyManager";
import { NovelAiService } from "./services/novelAiService";
import { TextRouter } from "./services/textProviders";
import { AudioService } from "./services/audioService";
import { HeadingCodeLens } from "./services/headingCodeLens";
import { ContinuityDiagnostics } from "./services/diagnostics";
import * as cmds from "./commands";
import { StudioStatusBar } from "./services/statusBar";

export function activate(context: vscode.ExtensionContext) {
  const keyManager = new KeyManager(context.secrets);
  const diagnostics = new ContinuityDiagnostics();
  const provider = new NovelStudioProvider(context.extensionUri, keyManager, diagnostics);
  const text = new TextRouter(keyManager, new NovelAiService(() => keyManager.getKey("novelai")));
  const audio = new AudioService(keyManager);
  const lenses = new HeadingCodeLens();
  const status = new StudioStatusBar(keyManager);

  const wrap = (fn: () => Promise<void>) => async () => {
    try {
      await fn();
    } catch (err) {
      vscode.window.showErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  context.subscriptions.push(
    diagnostics.disposable,
    status.disposable,
    vscode.window.registerWebviewViewProvider(NovelStudioProvider.viewType, provider),
    vscode.languages.registerCodeLensProvider({ language: "markdown" }, lenses),
    vscode.commands.registerCommand("novelStudio.setKey", wrap(async () => {
      const service = await vscode.window.showQuickPick([...SECRET_SERVICES], { title: "Which service key?" });
      if (!service) return;
      const value = await vscode.window.showInputBox({ title: `Store ${service} key`, password: true });
      if (value) await keyManager.setKey(service, value);
    })),
    vscode.commands.registerCommand("novelStudio.setNovelAiKey", wrap(async () => {
      const value = await vscode.window.showInputBox({ title: "NovelAI token", password: true });
      if (value) await keyManager.setKey("novelai", value);
    })),
    vscode.commands.registerCommand("novelStudio.setOpenRouterKey", wrap(async () => {
      const value = await vscode.window.showInputBox({ title: "OpenRouter key", password: true });
      if (value) await keyManager.setKey("openrouter", value);
    })),
    vscode.commands.registerCommand("novelStudio.continueScene", wrap(() => cmds.continueScene(text, keyManager))),
    vscode.commands.registerCommand("novelStudio.expandSelection", wrap(() => cmds.expandSelection(text, keyManager))),
    vscode.commands.registerCommand("novelStudio.diffRewrite", wrap(() => cmds.diffRewrite(text, keyManager))),
    vscode.commands.registerCommand("novelStudio.multiAgent", wrap(() => cmds.multiAgent(text, keyManager))),
    vscode.commands.registerCommand("novelStudio.auditContinuity", wrap(() => cmds.runAudit(diagnostics))),
    vscode.commands.registerCommand("novelStudio.compileManuscript", wrap(() => cmds.compileAll())),
    vscode.commands.registerCommand("novelStudio.exportLora", wrap(() => cmds.exportLora())),
    vscode.commands.registerCommand("novelStudio.audiobookBatch", wrap(() => cmds.batchAudiobook(audio))),
    vscode.commands.registerCommand("novelStudio.runPrompt", wrap(() => cmds.pickPromptAndRun(text, keyManager))),
    vscode.commands.registerCommand("novelStudio.seedWorkspace", wrap(() => cmds.seedStudioFiles())),
    vscode.commands.registerCommand("novelStudio.polishSelection", wrap(async () => {
      await cmds.expandSelection(text, keyManager);
    })),
    vscode.commands.registerCommand("novelStudio.narrateChapter", wrap(async () => {
      const src = cmds.selection() || cmds.activeText();
      const rel = await audio.speak(src.slice(0, 4000), "openai");
      cmds.insert(`[narration](${rel})`);
    })),
    vscode.commands.registerCommand("novelStudio.revisionMode", wrap(() => cmds.revisionPass(text, keyManager))),
    vscode.commands.registerCommand("novelStudio.seedState", wrap(() => cmds.seedState())),
    vscode.commands.registerCommand("novelStudio.seedContract", wrap(() => cmds.seedContractCmd())),
    vscode.commands.registerCommand("novelStudio.buildVoices", wrap(() => cmds.buildVoices())),
    vscode.commands.registerCommand("novelStudio.outlineSync", wrap(() => cmds.outlineSyncCmd())),
    vscode.commands.registerCommand("novelStudio.analytics", wrap(() => cmds.analyticsCmd())),
    vscode.commands.registerCommand("novelStudio.snapshot", wrap(() => cmds.snapshotCmd())),
    vscode.commands.registerCommand("novelStudio.mergeBranch", wrap(() => cmds.mergeCmd())),
    vscode.commands.registerCommand("novelStudio.clipResearch", wrap(() => cmds.researchCmd())),
    vscode.commands.registerCommand("novelStudio.publishPackage", wrap(() => cmds.publishCmd())),
    vscode.commands.registerCommand("novelStudio.addComment", wrap(() => cmds.commentCmd())),
    vscode.commands.registerCommand("novelStudio.evalHarness", wrap(() => cmds.evalCmd())),
    vscode.commands.registerCommand("novelStudio.readAloudQa", wrap(() => cmds.readAloudCmd())),
    vscode.commands.registerCommand("novelStudio.bootstrap", wrap(() => cmds.bootstrapCmd())),
    vscode.commands.registerCommand("novelStudio.importDocx", wrap(() => cmds.importDocxCmd())),
    vscode.commands.registerCommand("novelStudio.archiveProject", wrap(() => cmds.archiveCmd())),
    vscode.commands.registerCommand("novelStudio.applyStatePatch", wrap(() => cmds.applyStateFromSelection())),
    vscode.commands.registerCommand("novelStudio.runUnitTests", wrap(() => cmds.runTestsCmd())),
    vscode.window.onDidChangeActiveTextEditor(() => void status.refresh()),
    vscode.workspace.onDidChangeTextDocument(() => void status.refresh()),
  );

  void cmds.seedStudioFiles().catch(() => undefined);
  void status.refresh();
}

export function deactivate() {}
