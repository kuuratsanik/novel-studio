import * as vscode from "vscode";

export interface LtMatch {
  message: string;
  offset: number;
  length: number;
}

export async function lintWithLanguageTool(text: string): Promise<LtMatch[]> {
  const url =
    vscode.workspace.getConfiguration("novelStudio").get<string>("languageToolUrl") ||
    "http://127.0.0.1:8081/v2/check";
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text, language: "en-US" }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { matches?: LtMatch[] };
    return data.matches || [];
  } catch {
    return [];
  }
}

export async function probeLanguageTool(): Promise<boolean> {
  const url =
    vscode.workspace.getConfiguration("novelStudio").get<string>("languageToolUrl") ||
    "http://127.0.0.1:8081/v2/languages";
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
