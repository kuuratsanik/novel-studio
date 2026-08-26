import { readWorkspaceFile, writeWorkspaceFile } from "./workspaceIo";

const DEFAULTS: Record<string, string> = {
  continue: "Continue the scene in the established voice. Do not recap. Advance the beat.",
  expand: "Expand the selected beat with sensory detail. Do not add new plot facts unless required.",
  rewrite: "Rewrite the selection. Preserve meaning and proper names.",
  multi: "You are one pass in a writer/editor/auditor pipeline. Follow the role given.",
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
  return Object.keys(DEFAULTS);
}
