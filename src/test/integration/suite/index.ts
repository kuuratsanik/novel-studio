import * as assert from "assert";
import * as vscode from "vscode";

export async function run(): Promise<void> {
  const ext = vscode.extensions.getExtension("kuuratsanik.novel-studio");
  assert.ok(ext, "novel-studio extension should be present");
  await ext!.activate();
  assert.ok(ext!.isActive, "novel-studio should activate");

  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes("novelStudio.continueScene"), "continueScene command registered");
  assert.ok(commands.includes("novelStudio.exportEpub"), "exportEpub command registered");
}
