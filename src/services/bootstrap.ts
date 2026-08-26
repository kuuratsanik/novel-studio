import { writeWorkspaceFile } from "./workspaceIo";
import { ensurePromptLibrary } from "./prompts";

export async function bootstrapWorkspace(title = "Untitled Novel"): Promise<string> {
  const files: Record<string, string> = {
    "studio.json": JSON.stringify({ pov: "third", tense: "past", banned: ["suddenly", "realized"] }, null, 2) + "\n",
    "codex/state.json": JSON.stringify({ updated: new Date().toISOString(), characters: [] }, null, 2) + "\n",
    "codex/characters.md": `# Characters\n\n## Protagonist\n\nDrive, flaw, voice.\n`,
    "codex/world_lore.md": `# World\n\nRules of this setting.\n`,
    "codex/items.md": `# Items\n`,
    "codex/plot_ideas.md": `# Plot ideas\n`,
    "drafts/ch01.md": `---\nbeat: Opening Image\nstatus: draft\n---\n\n# Chapter 1\n\nThe first image of ${title}.\n`,
    "drafts/contracts/ch01.json": JSON.stringify({
      goal: "Establish the ordinary world",
      conflict: "A small wrongness",
      turn: "The wrongness cannot be ignored",
      exit: "The protagonist acts",
      mustInclude: [],
      mustNot: [],
      complete: false,
    }, null, 2) + "\n",
    "research/.gitkeep": "",
    "gold/README.md": "Park 3–5 finished scenes here for the eval harness.\n",
    "assets/.gitkeep": "",
  };
  for (const [rel, body] of Object.entries(files)) {
    await writeWorkspaceFile(rel, body);
  }
  await ensurePromptLibrary();
  return `Bootstrapped ${title}: drafts/, codex/, contracts, prompts, research, gold.`;
}
