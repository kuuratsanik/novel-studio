import { listMarkdown, readWorkspaceFile, writeWorkspaceFile } from "./workspaceIo";

const DEFAULTS: Record<string, string> = {
  continue: "Continue the scene in the established voice. Do not recap. Advance the beat.",
  expand: "Expand the selected beat with sensory detail. Do not add new plot facts unless required.",
  polish: "Polish the selection for rhythm and clarity. Preserve meaning, names, and plot facts.",
  rewrite: "Rewrite the selection. Preserve meaning and proper names.",
  multi: "You are one pass in a writer/editor/auditor pipeline. Follow the role given.",
  continuity: "Role: continuity editor. Flag only contradictions vs bible and state. Then provide a corrected paragraph if needed.",
};

export async function ensurePromptLibrary(): Promise<void> {
  for (const [name, body] of Object.entries(DEFAULTS)) {
    const rel = `prompts/${name}.md`;
    try {
      await readWorkspaceFile(rel);
    } catch {
      await writeWorkspaceFile(rel, body + "\n");
    }
  }
}

export async function loadPrompt(name: string): Promise<string> {
  await ensurePromptLibrary();
  try {
    return (await readWorkspaceFile(`prompts/${name}.md`)).trim();
  } catch {
    return DEFAULTS[name] || "Write the next beat.";
  }
}

export async function listPrompts(): Promise<string[]> {
  await ensurePromptLibrary();
  const files = await listMarkdown();
  const fromDisk = files
    .filter((f) => f.rel.startsWith("prompts/") && f.rel.endsWith(".md"))
    .map((f) => f.rel.replace(/^prompts\//, "").replace(/\.md$/, ""));
  return [...new Set([...Object.keys(DEFAULTS), ...fromDisk])].sort();
}
