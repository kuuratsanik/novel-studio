import * as path from "path";
import * as fs from "fs";
import { listChapters } from "./chapterTimeline";
import { readWorkspaceFile, workspaceRoot, writeWorkspaceFile } from "./workspaceIo";

export interface AudiobookEntry {
  chapter: string;
  title: string;
  words: number;
  audio?: string;
  error?: string;
}

export async function batchNarrateChapters(
  narrate: (text: string, slug: string) => Promise<string>,
): Promise<string> {
  const chapters = await listChapters();
  if (!chapters.length) throw new Error("No draft chapters to narrate.");

  const entries: AudiobookEntry[] = [];
  for (const ch of chapters) {
    try {
      const text = await readWorkspaceFile(ch.rel);
      const prose = text.replace(/^---[\s\S]*?---\n/, "").trim();
      const slug = ch.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "chapter";
      const audio = await narrate(prose.slice(0, 4000), slug);
      entries.push({ chapter: ch.rel, title: ch.title, words: ch.words, audio });
    } catch (err) {
      entries.push({
        chapter: ch.rel,
        title: ch.title,
        words: ch.words,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const manifest = {
    built: new Date().toISOString(),
    chapters: entries,
    ok: entries.filter((e) => e.audio).length,
    failed: entries.filter((e) => e.error).length,
  };

  await writeWorkspaceFile("compile/audiobook-manifest.json", JSON.stringify(manifest, null, 2) + "\n");

  const lines = ["# Audiobook batch", "", `Generated ${manifest.built}`, "", `| Chapter | Words | Audio |`, `|---|---:|---|`];
  for (const e of entries) {
    lines.push(`| ${e.title} | ${e.words} | ${e.audio || e.error || "—"} |`);
  }
  await writeWorkspaceFile("compile/audiobook-batch.md", lines.join("\n") + "\n");

  const audioDir = path.join(workspaceRoot(), "assets/audio");
  await fs.promises.mkdir(audioDir, { recursive: true });

  return `compile/audiobook-batch.md (${manifest.ok}/${entries.length} narrated)`;
}
