import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";

export async function readAloudReport(): Promise<void> {
  const drafts = (await listMarkdown()).filter((f) => f.rel.startsWith("drafts/"));
  const flags: string[] = [];
  for (const d of drafts) {
    if (/\b(suddenly|realized|very very)\b/i.test(d.text)) flags.push(`${d.rel}: filler adverb cluster`);
  }
  await writeWorkspaceFile("compile/read-aloud-qa.md", `# Read-aloud QA\n\n${flags.join("\n") || "No flags."}\n`);
}
