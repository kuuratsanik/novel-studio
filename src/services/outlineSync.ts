import { listMarkdown, writeWorkspaceFile, readWorkspaceFile } from "./workspaceIo";
import { parseFrontmatter } from "./frontmatter";

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

  const existing = new Map(files.filter((f) => f.rel.startsWith("drafts/")).map((f) => [f.rel, f.text]));
  const created: string[] = [];
  const updated: string[] = [];

  for (let i = 0; i < beats.length; i++) {
    const slug = `ch${String(i + 1).padStart(2, "0")}`;
    const rel = `drafts/${slug}.md`;
    const contractRel = `drafts/contracts/${slug}.json`;
    const contract = {
      goal: `Deliver beat: ${beats[i]}`,
      conflict: "Obstacle emerges",
      turn: "Situation shifts",
      exit: "Hook to next chapter",
      mustInclude: [] as string[],
      mustNot: [] as string[],
      complete: true,
    };

    if (!existing.has(rel)) {
      const body = `---\nbeat: ${beats[i]}\nstatus: draft\norder: ${i + 1}\n---\n\n# Chapter ${i + 1}\n\n${beats[i]}\n`;
      await writeWorkspaceFile(rel, body);
      await writeWorkspaceFile(contractRel, JSON.stringify(contract, null, 2) + "\n");
      created.push(rel);
      existing.set(rel, body);
      continue;
    }

    const text = existing.get(rel)!;
    const { meta, body } = parseFrontmatter(text);
    const newBeat = beats[i];
    if (meta.beat !== newBeat || meta.order !== String(i + 1)) {
      const heading = body.match(/^# .+$/m)?.[0] || `# Chapter ${i + 1}`;
      const rest = body.replace(/^# .+$/m, "").trim();
      const next = `---\nbeat: ${newBeat}\nstatus: ${meta.status || "draft"}\norder: ${i + 1}\n---\n\n${heading}\n\n${rest || newBeat}\n`;
      await writeWorkspaceFile(rel, next);
      updated.push(rel);
    }

    try {
      const current = JSON.parse(await readWorkspaceFile(contractRel)) as { goal?: string };
      if (!current.goal?.includes(newBeat.slice(0, 20))) {
        await writeWorkspaceFile(contractRel, JSON.stringify(contract, null, 2) + "\n");
        updated.push(contractRel);
      }
    } catch {
      await writeWorkspaceFile(contractRel, JSON.stringify(contract, null, 2) + "\n");
      updated.push(contractRel);
    }
  }

  const summary = `# Outline sync\n\nCreated ${created.length} draft(s), updated ${updated.length} file(s).\n\n## Created\n${created.map((c) => `- ${c}`).join("\n") || "- none"}\n\n## Updated\n${updated.map((c) => `- ${c}`).join("\n") || "- none"}\n`;
  await writeWorkspaceFile("compile/outline-sync.md", summary);
  if (created.length || updated.length) {
    return `Outline sync: ${created.length} created, ${updated.length} updated`;
  }
  return "Outline already in sync with beats";
}
