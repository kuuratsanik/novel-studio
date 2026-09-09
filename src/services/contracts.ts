import * as path from "path";
import * as vscode from "vscode";
import { readWorkspaceFile, writeWorkspaceFile } from "./workspaceIo";
import { BLANK_CONTRACT, SceneContract, contractPath } from "../core/contract";

export { contractReady, contractPath, contractPrompt } from "../core/contract";
export type { SceneContract } from "../core/contract";

export function currentDraftRel(): string | undefined {
  const ed = vscode.window.activeTextEditor;
  if (!ed) return undefined;
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return undefined;
  const rel = path.relative(folder.uri.fsPath, ed.document.uri.fsPath).replace(/\\/g, "/");
  return rel.startsWith("drafts/") && rel.endsWith(".md") ? rel : undefined;
}

export async function loadContract(
  draftRel: string,
): Promise<{ rel: string; contract: SceneContract } | undefined> {
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
  await writeWorkspaceFile(dest, JSON.stringify(BLANK_CONTRACT, null, 2) + "\n");
  return dest;
}
