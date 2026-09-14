import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import { compileManuscript, exportHtml, exportPdf, exportTypst } from "./compiler";
import { exportEpub } from "./epubExport";
import { writeGrammarReport } from "./grammarLint";
import { writeAnalytics } from "./analytics";
import { writeWorkspaceFile, readWorkspaceFile, workspaceRoot } from "./workspaceIo";
import { loadStudioConfig } from "./studioConfig";

const execFileAsync = promisify(execFile);

function findCover(root: string): string | undefined {
  for (const rel of ["assets/cover.jpg", "assets/cover.png", "assets/cover.webp", "cover.jpg", "cover.png"]) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) return rel;
  }
  return undefined;
}

export async function publishPackage(): Promise<string> {
  await compileManuscript();
  await exportHtml();
  await writeAnalytics();
  await writeGrammarReport();

  let epub = "";
  let pdf = "";
  let typst = "";
  try {
    epub = await exportEpub();
  } catch {
    epub = "skipped";
  }
  try {
    pdf = await exportPdf();
  } catch {
    pdf = "skipped";
  }
  try {
    typst = await exportTypst();
  } catch {
    typst = "skipped";
  }

  const studio = await loadStudioConfig();
  const title = studio.title || "Manuscript";
  const slug = title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "manuscript";
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `compile/publish-${stamp}`;
  const root = workspaceRoot();
  const cover = findCover(root);

  const manifest = {
    title,
    isbn: studio.isbn || "",
    wordTarget: studio.wordTarget || 80000,
    pov: studio.pov || "third",
    tense: studio.tense || "past",
    built: new Date().toISOString(),
    cover: cover || null,
    files: [
      "manuscript.md",
      "manuscript.html",
      "analytics.md",
      "grammar-lint.md",
      epub !== "skipped" ? path.basename(epub) : null,
      pdf !== "skipped" ? path.basename(pdf) : null,
      typst !== "skipped" ? path.basename(typst) : null,
      cover ? path.basename(cover) : null,
    ].filter(Boolean),
  };

  await writeWorkspaceFile(`${base}/README.md`, `# ${title} — publish pack v3\n\nGenerated ${manifest.built}.\n`);
  await writeWorkspaceFile(`${base}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");

  await writeWorkspaceFile(`${base}/manuscript.md`, await readWorkspaceFile("compile/manuscript.md"));
  await writeWorkspaceFile(`${base}/manuscript.html`, await readWorkspaceFile("compile/manuscript.html"));
  await writeWorkspaceFile(`${base}/analytics.md`, await readWorkspaceFile("compile/analytics.md"));
  await writeWorkspaceFile(`${base}/grammar-lint.md`, await readWorkspaceFile("compile/grammar-lint.md"));

  if (epub !== "skipped") {
    await writeWorkspaceFile(`${base}/${path.basename(epub)}`, await readWorkspaceFile(epub));
  }
  if (pdf !== "skipped" && pdf.endsWith(".pdf")) {
    const src = path.join(root, pdf);
    const dest = path.join(root, base, path.basename(pdf));
    await fs.promises.copyFile(src, dest);
  }
  if (typst !== "skipped") {
    await writeWorkspaceFile(`${base}/${path.basename(typst)}`, await readWorkspaceFile(typst));
  }
  if (cover) {
    const src = path.join(root, cover);
    const dest = path.join(root, base, path.basename(cover));
    await fs.promises.copyFile(src, dest);
  } else {
    await writeWorkspaceFile(`${base}/cover-placeholder.txt`, `Cover image placeholder for "${title}". Add assets/cover.jpg before KDP upload.\n`);
  }

  const buildDir = path.join(root, base);
  const outRel = `${base}/${slug}-kdp.zip`;

  try {
    await execFileAsync("zip", ["-r", `${slug}-kdp.zip`, "."], { cwd: buildDir });
    return outRel;
  } catch {
    await writeWorkspaceFile(
      `${base}/BUILD.md`,
      `# Publish pack v3\n\nAll formats copied under \`${base}/\`. Install \`zip\` to build ${slug}-kdp.zip automatically.\n`,
    );
    return `${base}/ (see BUILD.md)`;
  }
}
