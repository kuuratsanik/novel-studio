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
  const log = vscode.window.createOutputChannel("Novel Studio", { log: true });
  const keyManager = new KeyManager(context.secrets);
  const diagnostics = new ContinuityDiagnostics();
  const provider = new NovelStudioProvider(context.extensionUri);
  const text = new TextRouter(keyManager, new NovelAiService(() => keyManager.getKey("novelai")));
  const audio = new AudioService(keyManager);
  const lenses = new HeadingCodeLens();
  const status = new StudioStatusBar();

  const wrap = (fn: () => Promise<void>) => async () => {
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(err instanceof Error ? err : new Error(message));
      vscode.window.showErrorMessage(message);
    }
  };

  const register = (id: string, fn: () => Promise<void>) =>
    vscode.commands.registerCommand(id, wrap(fn));

  let auditTimer: NodeJS.Timeout | undefined;
  const scheduleAudit = (doc: vscode.TextDocument) => {
    const enabled = vscode.workspace
      .getConfiguration("novelStudio")
      .get<boolean>("auditOnSave", true);
    if (!enabled || doc.languageId !== "markdown") return;
    if (auditTimer) clearTimeout(auditTimer);
    auditTimer = setTimeout(() => {
      void diagnostics
        .runOnEditor()
        .then((n) => status.setFlags(n))
        .catch((err) => log.error(err instanceof Error ? err : new Error(String(err))));
    }, 750);
  };

  context.subscriptions.push(
    log,
    diagnostics.disposable,
    status.disposable,
    new vscode.Disposable(() => auditTimer && clearTimeout(auditTimer)),
    vscode.window.registerWebviewViewProvider(NovelStudioProvider.viewType, provider),
    vscode.languages.registerCodeLensProvider({ language: "markdown" }, lenses),

    register("novelStudio.setKey", async () => {
      const service = await vscode.window.showQuickPick([...SECRET_SERVICES], {
        title: "Which service key?",
      });
      if (!service) return;
      const value = await vscode.window.showInputBox({
        title: `Store ${service} key`,
        password: true,
      });
      if (value) {
        await keyManager.setKey(service, value);
        vscode.window.showInformationMessage(`Stored ${service} key.`);
      }
    }),
    register("novelStudio.setNovelAiKey", async () => {
      const value = await vscode.window.showInputBox({ title: "NovelAI token", password: true });
      if (value) await keyManager.setKey("novelai", value);
    }),
    register("novelStudio.setOpenRouterKey", async () => {
      const value = await vscode.window.showInputBox({ title: "OpenRouter key", password: true });
      if (value) await keyManager.setKey("openrouter", value);
    }),

    register("novelStudio.continueScene", () => cmds.continueScene(text, keyManager)),
    register("novelStudio.expandSelection", () => cmds.expandSelection(text, keyManager)),
    register("novelStudio.diffRewrite", () => cmds.diffRewrite(text, keyManager)),
    register("novelStudio.multiAgent", () => cmds.multiAgent(text, keyManager)),
    register("novelStudio.auditContinuity", () => cmds.runAudit(diagnostics, status)),
    register("novelStudio.compileManuscript", () => cmds.compileAll()),
    register("novelStudio.exportLora", () => cmds.exportLora()),
    register("novelStudio.audiobookBatch", () => cmds.batchAudiobook(audio)),
    register("novelStudio.runPrompt", () => cmds.pickPromptAndRun(text, keyManager)),
    register("novelStudio.seedWorkspace", () => cmds.seedStudioFiles()),
    register("novelStudio.polishSelection", () => cmds.expandSelection(text, keyManager)),
    register("novelStudio.narrateChapter", () => cmds.narrateChapter(audio)),
    register("novelStudio.revisionMode", () => cmds.revisionPass(text, keyManager)),
    register("novelStudio.seedState", () => cmds.seedState()),
    register("novelStudio.seedContract", () => cmds.seedContractCmd()),
    register("novelStudio.buildVoices", () => cmds.buildVoices()),
    register("novelStudio.outlineSync", () => cmds.outlineSyncCmd()),
    register("novelStudio.analytics", () => cmds.analyticsCmd()),
    register("novelStudio.snapshot", () => cmds.snapshotCmd()),
    register("novelStudio.mergeBranch", () => cmds.mergeCmd()),
    register("novelStudio.clipResearch", () => cmds.researchCmd()),
    register("novelStudio.publishPackage", () => cmds.publishCmd()),
    register("novelStudio.addComment", () => cmds.commentCmd()),
    register("novelStudio.evalHarness", () => cmds.evalCmd()),
    register("novelStudio.readAloudQa", () => cmds.readAloudCmd()),
    register("novelStudio.bootstrap", () => cmds.bootstrapCmd()),
    register("novelStudio.importDocx", () => cmds.importDocxCmd()),
    register("novelStudio.archiveProject", () => cmds.archiveCmd()),
    register("novelStudio.applyStatePatch", () => cmds.applyStateFromSelection()),
    register("novelStudio.runUnitTests", () => cmds.runTestsCmd()),

    vscode.window.onDidChangeActiveTextEditor(() => void status.refresh()),
    vscode.workspace.onDidChangeTextDocument(() => void status.refresh()),
    vscode.workspace.onDidSaveTextDocument(scheduleAudit),
    context.secrets.onDidChange(() => void status.refresh()),
  );

  void status.refresh();
}

export function deactivate() {}
