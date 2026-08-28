import * as path from "path";
import * as vscode from "vscode";
import { readWorkspaceFile, writeWorkspaceFile } from "./workspaceIo";

export interface SceneContract {
  goal: string;
  conflict: string;
  turn: string;
  exit: string;
  mustInclude: string[];
  mustNot: string[];
  complete?: boolean;
}

export function contractReady(c: SceneContract): boolean {
  return !!(c.goal && c.conflict && c.turn && c.exit);
}

export function currentDraftRel(): string | undefined {
  const ed = vscode.window.activeTextEditor;
  if (!ed) return undefined;
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return undefined;
  const rel = path.relative(folder.uri.fsPath, ed.document.uri.fsPath).replace(/\\/g, "/");
  return rel.startsWith("drafts/") && rel.endsWith(".md") ? rel : undefined;
}

export function contractPath(draftRel: string): string {
  const stem = draftRel.replace(/^drafts\//, "").replace(/\.md$/, "");
  return `drafts/contracts/${stem}.json`;
}

export async function loadContract(draftRel: string): Promise<{ rel: string; contract: SceneContract } | undefined> {
  try {
    const rel = contractPath(draftRel);
    const contract = JSON.parse(await readWorkspaceFile(rel)) as SceneContract;
    return { rel, contract };
  } catch {
    return undefined;
  }
}

export async function seedContract(draftRel?: string): Promise<string> {
  const rel = draftRel || currentDraftRel() || "drafts/ch01.md";
  const dest = contractPath(rel);
  const blank: SceneContract = {
    goal: "",
    conflict: "",
    turn: "",
    exit: "",
    mustInclude: [],
    mustNot: [],
    complete: false,
  };
  await writeWorkspaceFile(dest, JSON.stringify(blank, null, 2) + "\n");
  return dest;
}

export function contractPrompt(c: SceneContract): string {
  return [
    `Scene contract:`,
    `Goal: ${c.goal}`,
    `Conflict: ${c.conflict}`,
    `Turn: ${c.turn}`,
    `Exit: ${c.exit}`,
    c.mustInclude.length ? `Must include: ${c.mustInclude.join("; ")}` : "",
    c.mustNot.length ? `Must not: ${c.mustNot.join("; ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
