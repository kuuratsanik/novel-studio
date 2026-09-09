import { contractPath, contractReady, loadContract, SceneContract, seedContract } from "./contracts";
import { readWorkspaceFile, writeWorkspaceFile } from "./workspaceIo";
import { parseFrontmatter } from "./frontmatter";

function firstHeading(text: string): string | undefined {
  const m = text.match(/^#{1,3}\s+(.+)$/m);
  return m?.[1]?.trim();
}

function tailSentence(text: string, max = 220): string {
  const body = text.replace(/^---[\s\S]*?---\n/, "").trim();
  const last = body.split(/(?<=[.!?])\s+/).filter(Boolean).pop() || body.slice(-max);
  return last.slice(0, max).trim();
}

export function inferSceneContract(draftText: string, existing?: SceneContract): SceneContract {
  const { meta: fm } = parseFrontmatter(draftText);
  const beat = fm.beat || firstHeading(draftText) || "Advance the scene";
  const hook = tailSentence(draftText);
  const base = existing || {
    goal: "",
    conflict: "",
    turn: "",
    exit: "",
    mustInclude: [],
    mustNot: [],
    complete: false,
  };
  return {
    goal: base.goal || `Fulfill beat: ${beat}`,
    conflict: base.conflict || "An obstacle blocks the protagonist's immediate aim",
    turn: base.turn || "The situation shifts before the scene ends",
    exit: base.exit || (hook ? `Land on: ${hook}` : "End on a hook into the next beat"),
    mustInclude: base.mustInclude,
    mustNot: base.mustNot,
    complete: true,
  };
}

export async function ensureSceneContract(draftRel: string): Promise<SceneContract> {
  let loaded = await loadContract(draftRel);
  if (!loaded) {
    await seedContract(draftRel);
    loaded = await loadContract(draftRel);
  }
  const current = loaded?.contract;
  if (current && contractReady(current)) return current;

  const draftText = await readWorkspaceFile(draftRel);
  const inferred = inferSceneContract(draftText, current);
  await writeWorkspaceFile(contractPath(draftRel), JSON.stringify(inferred, null, 2) + "\n");
  return inferred;
}
