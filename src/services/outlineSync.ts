import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";

export async function syncOutlineToDrafts(): Promise<string> {
  const files = await listMarkdown();
  const outline = files.find((f) => f.rel === "codex/beats.md" || f.rel === "outline.md");
  const drafts = files.filter((f) => f.rel.startsWith("drafts/") && f.rel.endsWith(".md"));
  const lines = ["# Outline sync", "", `Drafts: ${drafts.length}`, outline ? "Beat sheet found." : "No beat sheet."];
  await writeWorkspaceFile("compile/outline-sync.md", lines.join("\n") + "\n");
  return "Wrote compile/outline-sync.md";
}
