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
import { automationSettings, ensureWorkspaceReady, warmWorkspaceState } from "./services/automation";
import { WikiLinkCompletionProvider, WikiLinkHoverProvider } from "./services/wikiProviders";
import { scheduleEmbeddingRebuild } from "./services/embeddingScheduler";
import { invalidateMarkdownCache } from "./services/workspaceIo";
import { ContinuityCodeActionProvider } from "./services/continuityFixes";
import {
  getOrchestratorProgress,
  runOrchestrator,
  shouldOrchestrateOnOpen,
  shouldOrchestrateOnSave,
} from "./services/orchestrator";

function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return ((...args: unknown[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export function activate(context: vscode.ExtensionContext) {
  const keyManager = new KeyManager(context.secrets);
  const diagnostics = new ContinuityDiagnostics();
  const text = new TextRouter(keyManager, new NovelAiService(() => keyManager.getKey("novelai")));
  const provider = new NovelStudioProvider(context.extensionUri, {
    keys: keyManager,
    diagnostics,
    text,
  });
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

  const auditIfAutomatic = debounce(async () => {
    const auto = automationSettings();
    if (!auto.autoAuditOnSave) return;
    const n = await diagnostics.runOnEditor();
    status.setFlags(n);
    await status.refresh();
  }, 1200);

  const orchestrateOnSave = debounce(async () => {
    if (!shouldOrchestrateOnSave()) return;
    if (getOrchestratorProgress().running) return;
    await runOrchestrator("save", diagnostics).catch(() => undefined);
    await status.refresh();
    provider.refreshOrchestrator();
  }, 5000);

  context.subscriptions.push(
    diagnostics.disposable,
    status.disposable,
    vscode.window.registerWebviewViewProvider(NovelStudioProvider.viewType, provider),
    vscode.languages.registerCodeLensProvider({ language: "markdown" }, lenses),
    vscode.languages.registerCompletionItemProvider({ language: "markdown" }, new WikiLinkCompletionProvider(), "[", "[["),
    vscode.languages.registerHoverProvider({ language: "markdown" }, new WikiLinkHoverProvider()),
    vscode.languages.registerCodeActionsProvider(
      { language: "markdown" },
      new ContinuityCodeActionProvider(text, keyManager),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
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
    vscode.commands.registerCommand("novelStudio.continueScene", wrap(() => cmds.continueScene(text, keyManager, diagnostics))),
    vscode.commands.registerCommand("novelStudio.expandSelection", wrap(() => cmds.expandSelection(text, keyManager))),
    vscode.commands.registerCommand("novelStudio.diffRewrite", wrap(() => cmds.diffRewrite(text, keyManager))),
    vscode.commands.registerCommand("novelStudio.multiAgent", wrap(() => cmds.multiAgent(text, keyManager))),
    vscode.commands.registerCommand("novelStudio.auditContinuity", wrap(() => cmds.runAudit(diagnostics))),
    vscode.commands.registerCommand("novelStudio.compileManuscript", wrap(() => cmds.compileAll())),
    vscode.commands.registerCommand("novelStudio.exportHtml", wrap(() => cmds.exportHtmlCmd())),
    vscode.commands.registerCommand("novelStudio.exportPdf", wrap(() => cmds.exportPdfCmd())),
    vscode.commands.registerCommand("novelStudio.cancelGeneration", wrap(async () => cmds.cancelGenerationCmd())),
    vscode.commands.registerCommand("novelStudio.writeScene", wrap(() => cmds.writeSceneCmd(text, keyManager, diagnostics))),
    vscode.commands.registerCommand("novelStudio.runOrchestrator", wrap(async () => {
      const pick = await vscode.window.showQuickPick(
        [
          { label: "startup", description: "Bootstrap + infrastructure + wiki" },
          { label: "save", description: "Graph, links, analytics, audit" },
          { label: "full", description: "All maintenance tasks" },
          { label: "publish", description: "Compile + HTML + PDF + EPUB + KDP zip" },
        ],
        { title: "Orchestrator profile" },
      );
      if (!pick) return;
      await cmds.runOrchestratorCmd(pick.label as import("./services/orchestrator").OrchestratorProfile, diagnostics);
      provider.refreshOrchestrator();
    })),
    vscode.commands.registerCommand(
      "novelStudio.fixContinuity",
      wrap(async (...args: unknown[]) => {
        const message = String(args[0] || "");
        const uri = String(args[1] || "");
        const range = args[2] as vscode.Range;
        await cmds.fixContinuityCmd(text, keyManager, message, uri, range);
      }),
    ),
    vscode.commands.registerCommand("novelStudio.exportLora", wrap(() => cmds.exportLora())),
    vscode.commands.registerCommand("novelStudio.audiobookBatch", wrap(() => cmds.batchAudiobook(audio))),
    vscode.commands.registerCommand("novelStudio.runPrompt", wrap(() => cmds.pickPromptAndRun(text, keyManager))),
    vscode.commands.registerCommand("novelStudio.seedWorkspace", wrap(() => cmds.seedStudioFiles())),
    vscode.commands.registerCommand("novelStudio.polishSelection", wrap(() => cmds.polishSelectionCmd(text, keyManager))),
    vscode.commands.registerCommand("novelStudio.pickModel", wrap(() => cmds.pickModelCmd(keyManager))),
    vscode.commands.registerCommand("novelStudio.brokenLinks", wrap(() => cmds.brokenLinksCmd())),
    vscode.commands.registerCommand("novelStudio.wikiIndex", wrap(() => cmds.wikiIndexCmd())),
    vscode.commands.registerCommand("novelStudio.rebuildEmbeddings", wrap(() => cmds.rebuildEmbeddingsCmd())),
    vscode.commands.registerCommand("novelStudio.exportEpub", wrap(() => cmds.exportEpubCmd())),
    vscode.commands.registerCommand("novelStudio.compareSnapshot", wrap(() => cmds.compareSnapshotCmd())),
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
    vscode.window.onDidChangeActiveTextEditor(() => {
      void status.refresh();
      provider.refreshOnEditorChange();
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      void status.refresh();
      if (e.document.languageId === "markdown") auditIfAutomatic();
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (doc.languageId === "markdown") {
        invalidateMarkdownCache();
        void auditIfAutomatic();
        scheduleEmbeddingRebuild(doc);
        orchestrateOnSave();
        provider.refreshOnEditorChange();
      }
    }),
  );

  void (async () => {
    const booted = await ensureWorkspaceReady().catch(() => false);
    await cmds.seedStudioFiles().catch(() => undefined);
    await warmWorkspaceState();
    await status.refresh();
    if (booted) {
      vscode.window.showInformationMessage("Novel Studio bootstrapped your workspace automatically.");
    }
    if (shouldOrchestrateOnOpen()) {
      await runOrchestrator("startup", diagnostics).catch(() => undefined);
      provider.refreshOrchestrator();
    }
    await status.refresh();
  })();
}

export function deactivate() {}
