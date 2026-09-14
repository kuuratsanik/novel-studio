import { execFile, spawn } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import { workspaceRoot, writeWorkspaceFile } from "./workspaceIo";
import * as vscode from "vscode";

const execFileAsync = promisify(execFile);

export interface TtsProbe {
  piper: boolean;
  espeak: boolean;
  pico2wave: boolean;
}

export async function probeLocalTts(): Promise<TtsProbe> {
  const probe = async (cmd: string, args: string[] = ["--version"]): Promise<boolean> => {
    try {
      await execFileAsync(cmd, args, { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  };
  return {
    piper: await probe("piper", ["--help"]),
    espeak: await probe("espeak", ["--version"]),
    pico2wave: await probe("pico2wave", ["--help"]),
  };
}

async function speakPiper(text: string, abs: string): Promise<boolean> {
  const model = vscode.workspace.getConfiguration("novelStudio").get<string>("piperModel") || "";
  const modelPath = model.startsWith("/") ? model : path.join(workspaceRoot(), model);
  if (!model || !fs.existsSync(modelPath)) return false;
  return new Promise((resolve) => {
    const proc = spawn("piper", ["--model", modelPath, "--output_file", abs]);
    proc.stdin.write(text);
    proc.stdin.end();
    const timer = setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 120_000);
    proc.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0 && fs.existsSync(abs));
    });
  });
}

export async function speakLocal(text: string, slug = "narration"): Promise<string | undefined> {
  const safe = text.slice(0, 4000).replace(/[^\w\s.,!?'"-]/g, " ");
  if (!safe.trim()) return undefined;
  const rel = `assets/audio/${slug}-${Date.now()}.wav`;
  const abs = path.join(workspaceRoot(), rel);
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });

  const order = vscode.workspace.getConfiguration("novelStudio").get<string>("localTtsEngine") || "auto";
  const engines = order === "auto" ? ["piper", "espeak", "pico2wave"] : [order];

  for (const engine of engines) {
    try {
      if (engine === "piper" && (await speakPiper(safe, abs))) return rel;
      if (engine === "espeak") {
        await execFileAsync("espeak", ["-w", abs, safe], { timeout: 120_000 });
        return rel;
      }
      if (engine === "pico2wave") {
        await execFileAsync("pico2wave", ["-w", abs, safe], { timeout: 120_000 });
        return rel;
      }
    } catch {
      // try next engine
    }
  }

  await writeWorkspaceFile(
    "compile/tts-README.md",
    "# Local TTS\n\nInstall one of:\n\n- **Piper** + set `novelStudio.piperModel` to your `.onnx` voice\n- `sudo apt install espeak`\n- `sudo apt install libttspico-utils`\n",
  );
  return undefined;
}
