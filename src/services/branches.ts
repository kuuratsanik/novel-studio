import * as path from "path";
import * as vscode from "vscode";
import { currentDraftRel } from "./contracts";
import { readWorkspaceFile, writeWorkspaceFile, workspaceRoot } from "./workspaceIo";

export async function snapshotBranch(label?: string): Promise<string> {
  const rel = currentDraftRel();
  if (!rel) throw new Error("Open a drafts/*.md file to snapshot.");
  const slug = (label || (await vscode.window.showInputBox({ prompt: "Branch label", value: "alt" }))) ?? "alt";
  const safe = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const dest = `branches/${path.basename(rel, ".md")}/${safe}-${Date.now()}.md`;
  const body = await readWorkspaceFile(rel);
  await writeWorkspaceFile(dest, `<!-- trunk: ${rel} -->\n${body}`);
  return dest;
}

export async function compareSnapshot(): Promise<void> {
  const root = workspaceRoot();
  const files = await vscode.workspace.findFiles(new vscode.RelativePattern(root, "branches/**/*.md"));
  if (!files.length) throw new Error("No branches/ snapshots yet.");
  const pick = await vscode.window.showQuickPick(
    files.map((f) => path.relative(root, f.fsPath).replace(/\\/g, "/")),
    { title: "Compare which snapshot to its trunk?" },
  );
  if (!pick) return;
  const text = await readWorkspaceFile(pick);
  const trunkRel = text.match(/<!-- trunk:\s*(.+?)\s*-->/)?.[1] || currentDraftRel();
  if (!trunkRel) throw new Error("Snapshot is missing trunk reference.");
  const snapBody = text.replace(/<!-- trunk:[\s\S]*?-->\n?/, "");
  const tempRel = `compile/.diff-${Date.now()}.md`;
  await writeWorkspaceFile(tempRel, snapBody);
  const trunkUri = vscode.Uri.file(path.join(root, trunkRel));
  const snapUri = vscode.Uri.file(path.join(root, tempRel));
  await vscode.commands.executeCommand(
    "vscode.diff",
    trunkUri,
    snapUri,
    `${path.basename(trunkRel)} ↔ ${path.basename(pick)}`,
  );
}

export async function mergeBranch(): Promise<string> {
  const root = workspaceRoot();
  const files = await vscode.workspace.findFiles(new vscode.RelativePattern(root, "branches/**/*.md"));
  if (!files.length) throw new Error("No branches/ snapshots yet.");
  const pick = await vscode.window.showQuickPick(
    files.map((f) => path.relative(root, f.fsPath).replace(/\\/g, "/")),
    { title: "Merge which branch into its trunk?" },
  );
  if (!pick) return "";
  const text = await readWorkspaceFile(pick);
  const trunk = text.match(/<!-- trunk:\s*(.+?)\s*-->/)?.[1] || currentDraftRel();
  if (!trunk) throw new Error("Branch is missing a trunk: header.");
  await writeWorkspaceFile(trunk, text.replace(/<!-- trunk:[\s\S]*?-->\n?/, ""));
  return `Merged ${pick} → ${trunk}`;
}
