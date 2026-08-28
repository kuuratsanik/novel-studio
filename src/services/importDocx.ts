import * as vscode from "vscode";
import { inflateRawSync } from "zlib";
import { writeWorkspaceFile } from "./workspaceIo";

export async function importDocx(): Promise<string> {
  const picked = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Word: ["docx"] } });
  if (!picked?.[0]) return "";
  const bytes = Buffer.from(await vscode.workspace.fs.readFile(picked[0]));
  const xml = extractDocumentXml(bytes);
  const text = xml.replace(/<w:p[^>]*>/g, "\n\n").replace(/<[^>]+>/g, "").replace(/\n{3,}/g, "\n\n").trim();
  const rel = "drafts/import-01.md";
  await writeWorkspaceFile(rel, `# Imported\n\n${text}\n`);
  return `Imported ${rel}`;
}

function extractDocumentXml(buf: Buffer): string {
  const name = "word/document.xml";
  let offset = 0;
  while (offset + 30 <= buf.length) {
    if (buf.readUInt32LE(offset) !== 0x04034b50) break;
    const method = buf.readUInt16LE(offset + 8);
    const comp = buf.readUInt32LE(offset + 18);
    const nameLen = buf.readUInt16LE(offset + 26);
    const extra = buf.readUInt16LE(offset + 28);
    const n = buf.slice(offset + 30, offset + 30 + nameLen).toString("utf8");
    const start = offset + 30 + nameLen + extra;
    const raw = buf.slice(start, start + comp);
    if (n === name) {
      if (method === 0) return raw.toString("utf8");
      return inflateRawSync(raw).toString("utf8");
    }
    offset = start + comp;
  }
  throw new Error("Not a valid .docx");
}
