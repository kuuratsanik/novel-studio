import * as vscode from "vscode";
import { bootstrapWorkspace } from "./bootstrap";
import { ensureBeats } from "./beats";
import { ensurePromptLibrary } from "./prompts";
import { readWorkspaceFile } from "./workspaceIo";
import { seedStateFromCodex } from "./stateMachine";

export interface AutomationSettings {
  fullyAutomatic: boolean;
  offlineFirst: boolean;
  autoAuditOnSave: boolean;
  autoBootstrap: boolean;
  autoApplyStatePatches: boolean;
  autoApplyRewrites: boolean;
  autoRouteSidebarOutput: boolean;
}

export function automationSettings(): AutomationSettings {
  const cfg = vscode.workspace.getConfiguration("novelStudio");
  const fullyAutomatic = cfg.get<boolean>("fullyAutomatic") ?? true;
  return {
    fullyAutomatic,
    offlineFirst: cfg.get<boolean>("offlineFirst") ?? true,
    autoAuditOnSave: cfg.get<boolean>("autoAuditOnSave") ?? true,
    autoBootstrap: cfg.get<boolean>("autoBootstrap") ?? true,
    autoApplyStatePatches: cfg.get<boolean>("autoApplyStatePatches") ?? fullyAutomatic,
    autoApplyRewrites: cfg.get<boolean>("autoApplyRewrites") ?? fullyAutomatic,
    autoRouteSidebarOutput: cfg.get<boolean>("autoRouteSidebarOutput") ?? fullyAutomatic,
  };
}

export async function probeLocalEngine(localUrl = "http://127.0.0.1:11434"): Promise<boolean> {
  try {
    const res = await fetch(`${localUrl.replace(/\/$/, "")}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function ensureWorkspaceReady(): Promise<boolean> {
  const auto = automationSettings();
  if (!auto.autoBootstrap && !auto.fullyAutomatic) return false;
  try {
    await readWorkspaceFile("studio.json");
    await ensurePromptLibrary();
    await ensureBeats();
    return false;
  } catch {
    await bootstrapWorkspace("Untitled Novel");
    await ensurePromptLibrary();
    await ensureBeats();
    return true;
  }
}

export async function warmWorkspaceState(): Promise<void> {
  const auto = automationSettings();
  if (!auto.fullyAutomatic) return;
  try {
    await seedStateFromCodex();
  } catch {
    // workspace may not be open yet
  }
}
