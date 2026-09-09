import { isNovelWorkspace, readWorkspaceFile, writeWorkspaceFile } from "./workspaceIo";

const BEAT_SHEET = [
  "# Beat sheet",
  "",
  "- Opening image",
  "- Theme stated",
  "- Setup",
  "- Catalyst",
  "- Debate",
  "- Break into two",
  "- B story",
  "- Fun and games",
  "- Midpoint",
  "- Bad guys close in",
  "- All is lost",
  "- Dark night",
  "- Break into three",
  "- Finale",
  "- Final image",
  "",
].join("\n");

export async function ensureBeats(force = false): Promise<void> {
  if (!force && !(await isNovelWorkspace())) return;
  try {
    await readWorkspaceFile("codex/beats.md");
  } catch {
    await writeWorkspaceFile("codex/beats.md", BEAT_SHEET);
  }
}
