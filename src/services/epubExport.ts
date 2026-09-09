import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as vscode from "vscode";
import { listMarkdown, readWorkspaceFile, workspaceRoot, writeWorkspaceFile } from "./workspaceIo";
import { draftSortKey } from "./frontmatter";
import { epubCss, EpubTheme } from "./epubThemes";
import { loadStudioConfig } from "./studioConfig";
import { markdownToXhtml, wikiTitleSet } from "./markdownHtml";

const execFileAsync = promisify(execFile);

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function exportEpub(title = "Manuscript"): Promise<string> {
  const drafts = (await listMarkdown())
    .filter((f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"))
    .sort((a, b) => draftSortKey(a.rel, a.text) - draftSortKey(b.rel, b.text));

  if (!drafts.length) throw new Error("No draft chapters to export.");

  const studio = await loadStudioConfig();
  const bookTitle = studio.title || title;
  const wiki = await wikiTitleSet();

  const base = "compile/epub-build";
  await writeWorkspaceFile(`${base}/mimetype`, "application/epub+zip");
  await writeWorkspaceFile(
    `${base}/META-INF/container.xml`,
    `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
  );
  const theme = (vscode.workspace.getConfiguration("novelStudio").get<string>("epubTheme") || "serif") as EpubTheme;
  await writeWorkspaceFile(`${base}/OEBPS/style.css`, epubCss(theme));

  const items: string[] = [];
  const spine: string[] = [];
  const navPoints: string[] = [];

  for (let i = 0; i < drafts.length; i++) {
    const id = `ch${i + 1}`;
    const name = drafts[i].rel.replace(/^drafts\//, "").replace(/\.md$/, "");
    const xhtml = markdownToXhtml(drafts[i].text, name, wiki);
    await writeWorkspaceFile(`${base}/OEBPS/${id}.xhtml`, xhtml);
    items.push(`<item id="${id}" href="${id}.xhtml" media-type="application/xhtml+xml"/>`);
    spine.push(`<itemref idref="${id}"/>`);
    navPoints.push(`<navPoint id="nav${i + 1}" playOrder="${i + 1}"><navLabel><text>${esc(name)}</text></navLabel><content src="${id}.xhtml"/></navPoint>`);
  }

  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${esc(bookTitle)}</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="bookid">urn:novel-studio:${Date.now()}</dc:identifier>
  </metadata>
  <manifest>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    ${items.join("\n    ")}
  </manifest>
  <spine toc="ncx">${spine.join("\n    ")}</spine>
</package>`;
  await writeWorkspaceFile(`${base}/OEBPS/content.opf`, opf);

  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="urn:novel-studio:${Date.now()}"/></head>
  <docTitle><text>${esc(bookTitle)}</text></docTitle>
  <navMap>${navPoints.join("\n    ")}</navMap>
</ncx>`;
  await writeWorkspaceFile(`${base}/OEBPS/toc.ncx`, ncx);

  const slug = bookTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "manuscript";
  const outRel = `compile/${slug}.epub`;
  const root = workspaceRoot();
  const buildDir = path.join(root, base);

  try {
    await execFileAsync(
      "zip",
      ["-X0", `../${slug}.epub`, "mimetype", "META-INF/container.xml", "OEBPS/content.opf", "OEBPS/toc.ncx", "OEBPS/style.css", ...drafts.map((_, i) => `OEBPS/ch${i + 1}.xhtml`)],
      { cwd: buildDir },
    );
    return outRel;
  } catch {
    await writeWorkspaceFile(
      "compile/epub-README.md",
      `# EPUB build\n\nEPUB source written to \`${base}/\`. Install \`zip\` and run from that folder:\n\n\`\`\`bash\ncd ${base}\nzip -X0 ../manuscript.epub mimetype META-INF/container.xml OEBPS/*\n\`\`\`\n`,
    );
    return `${base}/ (zip not found — see compile/epub-README.md)`;
  }
}
