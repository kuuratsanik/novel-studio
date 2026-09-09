import { readWorkspaceFile } from "./workspaceIo";

export interface StudioConfig {
  title?: string;
  pov?: "first" | "third" | string;
  tense?: "past" | "present" | string;
  wordTarget?: number;
  banned?: string[];
}

export async function loadStudioConfig(): Promise<StudioConfig> {
  try {
    return JSON.parse(await readWorkspaceFile("studio.json")) as StudioConfig;
  } catch {
    return {};
  }
}
