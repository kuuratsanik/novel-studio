import { listMarkdown, writeWorkspaceFile } from "./workspaceIo";

export async function exportLoraJsonl(): Promise<string> {
  const drafts = (await listMarkdown()).filter((f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"));
  const lines = drafts.map((d) => {
    const body = d.text.replace(/^---[\s\S]*?---\n/, "").trim();
    return JSON.stringify({
      instruction: "Continue this novel scene in the same voice.",
      input: body.slice(0, 2000),
      output: body.slice(0, 4000),
    });
  });
  return writeWorkspaceFile("compile/lora.jsonl", lines.join("\n") + "\n");
}
