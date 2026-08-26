import * as path from "path";
import * as vscode from "vscode";

export function workspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error("Open a folder workspace first.");
  }
  return folder.uri.fsPath;
}

export function uriFor(rel: string): vscode.Uri {
  return vscode.Uri.file(path.join(workspaceRoot(), rel));
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
