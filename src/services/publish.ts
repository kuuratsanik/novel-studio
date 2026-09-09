import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import { compileManuscript, exportHtml } from "./compiler";
import { writeWorkspaceFile, readWorkspaceFile, workspaceRoot } from "./workspaceIo";
import { loadStudioConfig } from "./studioConfig";

const execFileAsync = promisify(execFile);

export async function publishPackage(): Promise<string> {
  await compileManuscript();
  await exportHtml();

  const studio = await loadStudioConfig();
  const title = studio.title || "Manuscript";
  const slug = title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "manuscript";
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `compile/publish-${stamp}`;
  const manifest = {
    title,
    wordTarget: studio.wordTarget || 80000,
    pov: studio.pov || "third",
    tense: studio.tense || "past",
    built: new Date().toISOString(),
    files: ["manuscript.md", "manuscript.html", "analytics.md"],
  };

  await writeWorkspaceFile(`${base}/README.md`, `# ${title} — publish pack\n\nGenerated ${manifest.built}.\n`);
  await writeWorkspaceFile(`${base}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");

  let analytics = "";
  try {
    analytics = await readWorkspaceFile("compile/analytics.md");
  } catch {
    analytics = "# Analytics\n\nRun Novel Studio: Analytics Dashboard first.\n";
  }
  await writeWorkspaceFile(`${base}/analytics.md`, analytics);

  const root = workspaceRoot();
  const buildDir = path.join(root, base);
  const outRel = `${base}/${slug}-kdp.zip`;

  await writeWorkspaceFile(`${base}/manuscript.md`, await readWorkspaceFile("compile/manuscript.md"));
  await writeWorkspaceFile(`${base}/manuscript.html`, await readWorkspaceFile("compile/manuscript.html"));

  try {
    await execFileAsync("zip", ["-r", `${slug}-kdp.zip`, "."], { cwd: buildDir });
    return outRel;
  } catch {
    await writeWorkspaceFile(
      `${base}/BUILD.md`,
      `# Publish pack\n\nManuscript and HTML copied under \`${base}/\`. Install \`zip\` to build ${slug}-kdp.zip automatically.\n`,
    );
    return `${base}/ (see BUILD.md)`;
  }
}
