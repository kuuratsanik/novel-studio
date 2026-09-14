import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import { workspaceRoot, writeWorkspaceFile } from "./workspaceIo";

const execFileAsync = promisify(execFile);

const EXCLUDE = new Set(["node_modules", ".git", ".vscode-test", "out", ".novel-studio/cache"]);

export async function archiveProject(): Promise<string> {
  const root = workspaceRoot();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outRel = `compile/novel-archive-${stamp}.zip`;
  const outAbs = path.join(root, outRel);

  await fs.promises.mkdir(path.dirname(outAbs), { recursive: true });

  try {
    const files: string[] = [];
    const walk = async (dir: string, prefix = "") => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (EXCLUDE.has(e.name)) continue;
        const rel = prefix ? `${prefix}/${e.name}` : e.name;
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) await walk(abs, rel);
        else files.push(rel);
      }
    };
    await walk(root);

    const listFile = path.join(root, "compile", `.archive-list-${stamp}.txt`);
    await fs.promises.writeFile(listFile, files.join("\n"));
    await execFileAsync("zip", ["-r", outAbs, "-@", listFile], { cwd: root, timeout: 120_000 });
    await fs.promises.unlink(listFile).catch(() => undefined);
    return outRel;
  } catch {
    await writeWorkspaceFile(
      `compile/archive-note-${stamp}.md`,
      "# Archive\n\nInstall `zip` or run:\n\n```bash\nzip -r novel-backup.zip . -x 'node_modules/*' '.git/*'\n```\n",
    );
    return `compile/archive-note-${stamp}.md`;
  }
}
