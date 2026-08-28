import { writeWorkspaceFile } from "./workspaceIo";

export async function archiveProject(): Promise<string> {
  const dest = `compile/project-archive-note-${Date.now()}.md`;
  await writeWorkspaceFile(dest, "# Archive\n\nUse git or zip the workspace folder excluding node_modules.\n");
  return dest;
}
