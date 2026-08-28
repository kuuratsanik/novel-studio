import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";

export async function exportLoraJsonl(): Promise<string> {
  const drafts = (await listMarkdown()).filter((f) => f.rel.startsWith("drafts/"));
  const lines = drafts.map((d) => JSON.stringify({ text: d.text.slice(0, 4000) }));
  return writeWorkspaceFile("compile/lora.jsonl", lines.join("\n") + "\n");
}
