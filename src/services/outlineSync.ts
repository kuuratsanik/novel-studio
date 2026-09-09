import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";

export async function syncOutlineToDrafts(): Promise<string> {
  const files = await listMarkdown();
  const outline = files.find((f) => f.rel === "codex/beats.md" || f.rel === "outline.md");
  if (!outline) {
    await writeWorkspaceFile("compile/outline-sync.md", "# Outline sync\n\nNo beat sheet found.\n");
    return "No beat sheet at codex/beats.md";
  }

  const beats = outline.text
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*]\s+/, "").trim())
    .filter((l) => l && !l.startsWith("#"));

  const existing = new Set(files.filter((f) => f.rel.startsWith("drafts/")).map((f) => f.rel));
  const created: string[] = [];

  for (let i = 0; i < beats.length; i++) {
    const slug = `ch${String(i + 1).padStart(2, "0")}`;
    const rel = `drafts/${slug}.md`;
    if (existing.has(rel)) continue;
    const body = `---\nbeat: ${beats[i]}\nstatus: draft\norder: ${i + 1}\n---\n\n# Chapter ${i + 1}\n\n${beats[i]}\n`;
    await writeWorkspaceFile(rel, body);
    const contract = {
      goal: `Deliver beat: ${beats[i]}`,
      conflict: "Obstacle emerges",
      turn: "Situation shifts",
      exit: "Hook to next chapter",
      mustInclude: [],
      mustNot: [],
      complete: true,
    };
    await writeWorkspaceFile(`drafts/contracts/${slug}.json`, JSON.stringify(contract, null, 2) + "\n");
    created.push(rel);
    existing.add(rel);
  }

  const summary = `# Outline sync\n\nCreated ${created.length} draft(s):\n${created.map((c) => `- ${c}`).join("\n") || "- none"}\n`;
  await writeWorkspaceFile("compile/outline-sync.md", summary);
  return created.length ? `Created ${created.length} draft(s) from beats` : "All beat drafts already exist";
}
