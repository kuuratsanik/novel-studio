import * as path from "path";
import * as vscode from "vscode";

export async function appendToCodex(filename: string, header: string, content: string): Promise<string> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) throw new Error("Open a workspace folder first.");

  const codexDir = path.join(folders[0].uri.fsPath, "codex");
  const codexPath = path.join(codexDir, filename);
  const dirUri = vscode.Uri.file(codexDir);
  const codexUri = vscode.Uri.file(codexPath);

  try {
    await vscode.workspace.fs.createDirectory(dirUri);
  } catch {
    // already exists
  }

  let existingContent = "";
  try {
    const fileData = await vscode.workspace.fs.readFile(codexUri);
    existingContent = Buffer.from(fileData).toString("utf8");
  } catch {
    // new file
  }

  const entry = `\n\n## ${header} (Added: ${new Date().toLocaleDateString()})\n\n${content}\n`;
  await vscode.workspace.fs.writeFile(codexUri, Buffer.from(existingContent + entry, "utf8"));
  return `codex/${filename}`;
}
