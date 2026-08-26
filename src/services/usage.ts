import { writeWorkspaceFile, readWorkspaceFile } from "./workspaceIo";

export async function logUsage(entry: {
  provider: string;
  model: string;
  promptChars: number;
  outputChars: number;
}): Promise<void> {
  const tokensIn = Math.ceil(entry.promptChars / 4);
  const tokensOut = Math.ceil(entry.outputChars / 4);
  const line = `| ${new Date().toISOString()} | ${entry.provider} | ${entry.model} | ${tokensIn} | ${tokensOut} | ${tokensIn + tokensOut} |`;
  let existing = "";
  try {
    existing = await readWorkspaceFile("compile/usage.md");
  } catch {
    existing = "# Usage ledger\n\n| When | Provider | Model | In | Out | Total |\n|---|---|---|---:|---:|---:|\n";
  }
  if (!existing.includes("| When |")) {
    existing = "# Usage ledger\n\n| When | Provider | Model | In | Out | Total |\n|---|---|---|---:|---:|---:|\n" + existing;
  }
  await writeWorkspaceFile("compile/usage.md", existing.trimEnd() + "\n" + line + "\n");
}
