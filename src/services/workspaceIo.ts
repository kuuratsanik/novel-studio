import * as path from "path";
import * as vscode from "vscode";

/** Markers that identify a folder as an actual Novel Studio project. */
const PROJECT_MARKERS = ["studio.json", "drafts", "codex"];

export function hasWorkspaceFolder(): boolean {
  return !!vscode.workspace.workspaceFolders?.length;
}

export function workspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error("Open a folder workspace first.");
  }
  return folder.uri.fsPath;
}

export function uriFor(rel: string): vscode.Uri {
  const root = workspaceRoot();
  const target = path.resolve(root, rel);
  const contained = target === root || target.startsWith(root + path.sep);
  if (!contained) {
    throw new Error(`Refusing to touch a path outside the workspace: ${rel}`);
  }
  return vscode.Uri.file(target);
}

/**
 * True when the open folder already looks like a novel project. Used to keep
 * the extension from scaffolding files into unrelated repositories that merely
 * happen to contain Markdown.
 */
export async function isNovelWorkspace(): Promise<boolean> {
  if (!hasWorkspaceFolder()) return false;
  const root = workspaceRoot();
  for (const marker of PROJECT_MARKERS) {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(path.join(root, marker)));
      return true;
    } catch {
      // Marker absent; try the next one.
    }
  }
  return false;
}

export async function writeWorkspaceFile(rel: string, content: string | Buffer): Promise<string> {
  const uri = uriFor(rel);
  await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(uri.fsPath)));
  const data = typeof content === "string" ? Buffer.from(content, "utf8") : content;
  await vscode.workspace.fs.writeFile(uri, data);
  return rel;
}

export async function readWorkspaceFile(rel: string): Promise<string> {
  const data = await vscode.workspace.fs.readFile(uriFor(rel));
  return Buffer.from(data).toString("utf8");
}

export async function listMarkdown(): Promise<{ rel: string; text: string }[]> {
  const root = workspaceRoot();
  const out: { rel: string; text: string }[] = [];
  async function walk(dir: string, prefix: string) {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
    } catch {
      return;
    }
    for (const [name, type] of entries) {
      if (name.startsWith(".")) continue;
      const abs = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      if (type === vscode.FileType.Directory) {
        if (name === "node_modules" || name === "out") continue;
        await walk(abs, rel);
      } else if (name.endsWith(".md")) {
        const text = Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.file(abs))).toString("utf8");
        out.push({ rel, text });
      }
    }
  }
  await walk(root, "");
  return out;
}
