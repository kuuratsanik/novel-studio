import * as vscode from "vscode";
import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";
import { probeLocalEngine, ensureWorkspaceReady, warmWorkspaceState } from "./automation";
import { ensurePromptLibrary } from "./prompts";
import { ensureBeats } from "./beats";
import { seedStateFromCodex } from "./stateMachine";
import { buildWikiIndex } from "./wikiIndex";
import { writeBrokenLinkReport } from "./brokenLinks";
import { saveManuscriptGraph } from "./manuscriptGraph";
import { rebuildEmbeddings } from "./embeddings";
import { buildVoiceModels } from "./characterVoice";
import { syncOutlineToDrafts } from "./outlineSync";
import { writeAnalytics } from "./analytics";
import { compileManuscript, exportHtml, exportPdf } from "./compiler";
import { exportEpub } from "./epubExport";
import { publishPackage } from "./publish";
import { auditProse } from "./continuity";
import { ContinuityDiagnostics } from "./diagnostics";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type OrchestratorProfile = "startup" | "save" | "full" | "publish" | "ci";

export interface OrchestratorTaskResult {
  id: string;
  label: string;
  status: "ok" | "skipped" | "error";
  message: string;
  ms: number;
}

export interface OrchestratorRunResult {
  profile: OrchestratorProfile;
  started: string;
  finished: string;
  tasks: OrchestratorTaskResult[];
}

export interface OrchestratorProgress {
  running: boolean;
  profile?: OrchestratorProfile;
  currentTask?: string;
  completed: number;
  total: number;
  lastResult?: OrchestratorRunResult;
}

let running = false;
let progress: OrchestratorProgress = { running: false, completed: 0, total: 0 };
let lastResult: OrchestratorRunResult | undefined;

export function getOrchestratorProgress(): OrchestratorProgress {
  return { ...progress, lastResult };
}

async function probeBinary(cmd: string, args: string[] = ["--version"]): Promise<boolean> {
  try {
    await execFileAsync(cmd, args, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

interface TaskDef {
  id: string;
  label: string;
  profiles: OrchestratorProfile[];
  needsOllama?: boolean;
  run: () => Promise<string>;
}

function cfg() {
  return vscode.workspace.getConfiguration("novelStudio");
}

function buildTasks(diagnostics?: ContinuityDiagnostics): TaskDef[] {
  const localUrl = cfg().get<string>("localTextUrl") || "http://127.0.0.1:11434";

  return [
    {
      id: "workspace",
      label: "Workspace bootstrap",
      profiles: ["startup", "full", "ci"],
      run: async () => {
        const booted = await ensureWorkspaceReady();
        await ensurePromptLibrary();
        await ensureBeats();
        await warmWorkspaceState();
        await seedStateFromCodex().catch(() => undefined);
        return booted ? "Bootstrapped new workspace" : "Workspace ready";
      },
    },
    {
      id: "infrastructure",
      label: "Infrastructure probe",
      profiles: ["startup", "full", "ci"],
      run: async () => {
        const ollama = await probeLocalEngine(localUrl);
        const pandoc = await probeBinary("pandoc");
        const zip = await probeBinary("zip", ["-h"]);
        const espeak = await probeBinary("espeak", ["--version"]);
        const lines = [
          "# Infrastructure",
          "",
          `| Tool | Available |`,
          `|---|---|`,
          `| Ollama @ ${localUrl} | ${ollama ? "yes" : "no"} |`,
          `| pandoc | ${pandoc ? "yes" : "no"} |`,
          `| zip | ${zip ? "yes" : "no"} |`,
          `| espeak | ${espeak ? "yes" : "no"} |`,
          "",
        ];
        await writeWorkspaceFile("compile/infrastructure.md", lines.join("\n"));
        return `ollama=${ollama} pandoc=${pandoc} zip=${zip}`;
      },
    },
    {
      id: "wiki",
      label: "Wiki index",
      profiles: ["startup", "save", "full"],
      run: async () => {
        const { report } = await buildWikiIndex();
        await writeWorkspaceFile("compile/wiki-index.md", `# Wiki index\n\n${report}\n`);
        return "Wiki index built";
      },
    },
    {
      id: "broken-links",
      label: "Broken link scan",
      profiles: ["save", "full"],
      run: async () => {
        const dest = await writeBrokenLinkReport();
        return `Wrote ${dest}`;
      },
    },
    {
      id: "graph",
      label: "Manuscript graph",
      profiles: ["save", "full"],
      run: async () => {
        const dest = await saveManuscriptGraph();
        return `Graph saved (${dest})`;
      },
    },
    {
      id: "embeddings",
      label: "Embedding index",
      profiles: ["full"],
      needsOllama: true,
      run: async () => {
        if (!cfg().get<boolean>("embeddingRag")) return "skipped (embeddingRag off)";
        const n = await rebuildEmbeddings(localUrl);
        return `Indexed ${n} chunk(s)`;
      },
    },
    {
      id: "voices",
      label: "Voice models",
      profiles: ["full"],
      run: async () => {
        const models = await buildVoiceModels();
        return `Built ${models.length} voice model(s)`;
      },
    },
    {
      id: "outline",
      label: "Outline sync",
      profiles: ["full"],
      run: async () => syncOutlineToDrafts(),
    },
    {
      id: "analytics",
      label: "Analytics report",
      profiles: ["save", "full", "publish"],
      run: async () => {
        await writeAnalytics();
        return "Wrote compile/analytics.md";
      },
    },
    {
      id: "audit-active",
      label: "Audit active editor",
      profiles: ["save", "full"],
      run: async () => {
        if (!diagnostics) return "skipped (no diagnostics)";
        const n = await diagnostics.runOnEditor();
        return `${n} flag(s) on active draft`;
      },
    },
    {
      id: "audit-all",
      label: "Audit all drafts",
      profiles: ["full"],
      run: async () => {
        const drafts = (await listMarkdown()).filter(
          (f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"),
        );
        let flags = 0;
        for (const d of drafts) {
          flags += (await auditProse(d.text)).length;
        }
        return `${flags} flag(s) across ${drafts.length} draft(s)`;
      },
    },
    {
      id: "compile",
      label: "Compile manuscript",
      profiles: ["full", "publish"],
      run: async () => {
        const out = await compileManuscript();
        return out.join(", ");
      },
    },
    {
      id: "html",
      label: "Export HTML",
      profiles: ["publish"],
      run: async () => exportHtml(),
    },
    {
      id: "pdf",
      label: "Export PDF",
      profiles: ["publish"],
      run: async () => exportPdf(),
    },
    {
      id: "epub",
      label: "Export EPUB",
      profiles: ["publish"],
      run: async () => exportEpub(),
    },
    {
      id: "publish",
      label: "Publish / KDP zip",
      profiles: ["publish"],
      run: async () => publishPackage(),
    },
  ];
}

export async function runOrchestrator(
  profile: OrchestratorProfile,
  diagnostics?: ContinuityDiagnostics,
  onTask?: (task: OrchestratorTaskResult) => void,
): Promise<OrchestratorRunResult> {
  if (running) {
    throw new Error("Orchestrator already running. Wait for the current pipeline to finish.");
  }

  running = true;
  const localUrl = cfg().get<string>("localTextUrl") || "http://127.0.0.1:11434";
  const ollamaUp = await probeLocalEngine(localUrl);
  const tasks = buildTasks(diagnostics).filter((t) => t.profiles.includes(profile));
  const results: OrchestratorTaskResult[] = [];

  progress = { running: true, profile, completed: 0, total: tasks.length };

  const started = new Date().toISOString();
  for (const task of tasks) {
    progress.currentTask = task.label;
    const t0 = Date.now();
    let result: OrchestratorTaskResult;

    if (task.needsOllama && !ollamaUp) {
      result = { id: task.id, label: task.label, status: "skipped", message: "Ollama offline", ms: 0 };
    } else {
      try {
        const message = await task.run();
        const skipped = message.startsWith("skipped");
        result = {
          id: task.id,
          label: task.label,
          status: skipped ? "skipped" : "ok",
          message,
          ms: Date.now() - t0,
        };
      } catch (err) {
        result = {
          id: task.id,
          label: task.label,
          status: "error",
          message: err instanceof Error ? err.message : String(err),
          ms: Date.now() - t0,
        };
      }
    }

    results.push(result);
    progress.completed = results.length;
    onTask?.(result);
  }

  const finished = new Date().toISOString();
  const runResult: OrchestratorRunResult = { profile, started, finished, tasks: results };
  lastResult = runResult;
  progress = { running: false, completed: results.length, total: tasks.length, lastResult: runResult };

  const report = [
    `# Orchestrator — ${profile}`,
    "",
    `Started: ${started}`,
    `Finished: ${finished}`,
    "",
    "| Task | Status | Message | ms |",
    "|---|---|---|---:|",
    ...results.map((r) => `| ${r.label} | ${r.status} | ${r.message.replace(/\|/g, "/")} | ${r.ms} |`),
    "",
  ].join("\n");

  await writeWorkspaceFile("compile/orchestrator-report.md", report).catch(() => undefined);
  await appendOrchestratorLog(runResult).catch(() => undefined);

  running = false;
  return runResult;
}

async function appendOrchestratorLog(run: OrchestratorRunResult): Promise<void> {
  const line = JSON.stringify({ ...run, taskCount: run.tasks.length }) + "\n";
  try {
    const { readWorkspaceFile } = await import("./workspaceIo");
    const prev = await readWorkspaceFile(".novel-studio/orchestrator-log.jsonl").catch(() => "");
    await writeWorkspaceFile(".novel-studio/orchestrator-log.jsonl", prev + line);
  } catch {
    await writeWorkspaceFile(".novel-studio/orchestrator-log.jsonl", line);
  }
}

export function shouldOrchestrateOnOpen(): boolean {
  return cfg().get<boolean>("autoOrchestrateOnOpen") ?? true;
}

export function shouldOrchestrateOnSave(): boolean {
  return cfg().get<boolean>("orchestrateOnSave") ?? true;
}
