import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";

export async function runEval(): Promise<string> {
  const gold = (await listMarkdown()).filter((f) => f.rel.startsWith("gold/"));
  const report = `# Eval\n\nGold scenes: ${gold.length}\n`;
  await writeWorkspaceFile("compile/eval.md", report);
  return report;
}
