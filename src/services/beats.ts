import { writeWorkspaceFile, readWorkspaceFile } from "./workspaceIo";

export async function ensureBeats(): Promise<void> {
  try {
    await readWorkspaceFile("codex/beats.md");
  } catch {
    await writeWorkspaceFile(
      "codex/beats.md",
      "# Beat sheet\n\n- Opening image\n- Theme stated\n- Setup\n- Catalyst\n- Debate\n- Break into two\n- B story\n- Fun and games\n- Midpoint\n- Bad guys close in\n- All is lost\n- Dark night\n- Break into three\n- Finale\n- Final image\n",
    );
  }
}
