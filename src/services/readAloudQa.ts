import { listMarkdown, writeWorkspaceFile, readWorkspaceFile } from "./workspaceIo";
import { filterWordHits, sentenceLengths } from "./proseStats";

export async function readAloudReport(): Promise<void> {
  const drafts = (await listMarkdown()).filter((f) => f.rel.startsWith("drafts/"));
  let banned: string[] = ["suddenly", "realized", "very very"];
  try {
    const studio = JSON.parse(await readWorkspaceFile("studio.json")) as { banned?: string[] };
    if (studio.banned?.length) banned = studio.banned;
  } catch {
    // default banned list
  }

  const flags: string[] = [];
  for (const d of drafts) {
    for (const w of filterWordHits(d.text, banned)) {
      flags.push(`${d.rel}: banned/filter word "${w}"`);
    }
    const long = sentenceLengths(d.text).filter((n) => n > 28);
    if (long.length) flags.push(`${d.rel}: ${long.length} sentence(s) over 28 words`);
    if (/\b(\w+)\s+\1\b/i.test(d.text)) flags.push(`${d.rel}: repeated word in adjacent pair`);
  }

  await writeWorkspaceFile("compile/read-aloud-qa.md", `# Read-aloud QA\n\n${flags.join("\n") || "No flags."}\n`);
}
