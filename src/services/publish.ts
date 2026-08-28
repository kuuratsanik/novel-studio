import { compileManuscript } from "./compiler";
import { writeWorkspaceFile } from "./workspaceIo";

export async function publishPackage(): Promise<string> {
  await compileManuscript();
  const dest = `compile/publish-notes-${Date.now()}.md`;
  await writeWorkspaceFile(dest, "# Publish pack\n\nManuscript compiled to compile/manuscript.md\n");
  return dest;
}
