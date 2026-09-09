import { isNovelWorkspace, readWorkspaceFile, writeWorkspaceFile } from "./workspaceIo";

const DEFAULTS: Record<string, string> = {
  continue: "Continue the scene in the established voice. Do not recap. Advance the beat.",
  expand: "Expand the selected beat with sensory detail. Do not add new plot facts unless required.",
  rewrite: "Rewrite the selection. Preserve meaning and proper names.",
  multi: "You are one pass in a writer/editor/auditor pipeline. Follow the role given.",
};

/**
 * Writes the editable prompt files, but only into a folder that is already a
 * novel project. `force` is used by the explicit seed and bootstrap commands,
 * where the user has asked for scaffolding.
 */
export async function ensurePromptLibrary(force = false): Promise<void> {
  if (!force && !(await isNovelWorkspace())) return;
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
  try {
    const body = (await readWorkspaceFile(`prompts/${name}.md`)).trim();
    if (body) return body;
  } catch {
    // No override on disk; fall through to the built-in default.
  }
  return DEFAULTS[name] || "Write the next beat.";
}

export function listPrompts(): string[] {
  return Object.keys(DEFAULTS);
}
