import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { workspaceRoot, writeWorkspaceFile } from "./workspaceIo";

const execFileAsync = promisify(execFile);

export async function speakLocal(text: string, slug = "narration"): Promise<string | undefined> {
  const safe = text.slice(0, 2000).replace(/[^\w\s.,!?'-]/g, " ");
  const rel = `assets/audio/${slug}-${Date.now()}.wav`;
  const abs = path.join(workspaceRoot(), rel);

  try {
    await execFileAsync("espeak", ["-w", abs, safe], { timeout: 60_000 });
    return rel;
  } catch {
    try {
      await execFileAsync("pico2wave", ["-w", abs, safe], { timeout: 60_000 });
      return rel;
    } catch {
      await writeWorkspaceFile(
        "compile/tts-README.md",
        "# Local TTS\n\nInstall `espeak` or `pico2wave` for offline narration.\n",
      );
      return undefined;
    }
  }
}
