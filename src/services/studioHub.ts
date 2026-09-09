import { generatePacked, insert, replaceSel, selection } from "../commands";
import { TextRouter } from "./textProviders";
import { KeyManager } from "./keyManager";
import { loadPrompt } from "./prompts";
import { appendToCodex } from "./codexWriter";
import { applyPatches, proposeStatePatches } from "./statePatch";
import { loadState } from "./stateMachine";
import { automationSettings } from "./automation";
import { ContinuityDiagnostics } from "./diagnostics";
import { contractReady, currentDraftRel, loadContract } from "./contracts";
import { ensureSceneContract } from "./autoContract";
import * as vscode from "vscode";

export type StudioTool =
  | "storyGen"
  | "charGen"
  | "worldGen"
  | "dialogueGen"
  | "rephraseGen"
  | "plotTwist";

const TOOL_SYSTEM: Record<StudioTool, string> = {
  storyGen: "Write fiction prose only. Match the series voice. No meta commentary or outlines unless asked.",
  charGen: "Write a codex-ready character profile with motivation, flaw, voice, and hooks.",
  worldGen: "Write concise worldbuilding or item lore suitable for a series bible.",
  dialogueGen: "Write dialogue with subtext. Use proper attribution and beats.",
  rephraseGen: "Rewrite the selection. Preserve plot facts and proper names.",
  plotTwist: "Brainstorm plot twists as prose notes the author can use.",
};

function block(label: string, value?: string): string {
  const v = (value || "").trim();
  return v ? `[${label}]\n${v}` : "";
}

export function assembleToolPrompt(tool: StudioTool, fields: Record<string, string>): string {
  switch (tool) {
    case "storyGen":
      return [
        block("SCENE GOAL & OBSTACLE", fields.goal),
        block("CHARACTERS & TONE", fields.chars),
        block("ENDING BEAT / REVEAL", fields.ending),
        fields.mode ? block("MODE", fields.mode) : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    case "charGen":
      return [
        block("CHARACTER ARCHETYPE", fields.name),
        block("MOTIVATION & FLAW", fields.flaw),
        block("VOICE & QUIRKS", fields.voice),
      ]
        .filter(Boolean)
        .join("\n\n");
    case "worldGen":
      return [block("LORE SUBJECT / ITEM", fields.subject), block("RULES & SENSORY ANCHORS", fields.rules)]
        .filter(Boolean)
        .join("\n\n");
    case "dialogueGen":
      return [
        block("SPEAKERS & DYNAMIC", fields.speakers),
        block("SUBTEXT & UNCONFRONTED TRUTHS", fields.subtext),
        fields.mode ? block("MODE", fields.mode) : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    case "rephraseGen": {
      const src = selection();
      return [
        block("EDITING GOAL & TONE", fields.tone),
        block("CONSTRAINTS", fields.rules),
        src ? block("SELECTION", src) : "",
      ]
        .filter(Boolean)
        .join("\n\n");
    }
    case "plotTwist":
      return [block("CURRENT BELIEF / SETUP", fields.premise), block("WHAT MUST STAY TRUE", fields.constraint)]
        .filter(Boolean)
        .join("\n\n");
    default:
      return fields.prompt || "Continue the story.";
  }
}

export function describeRoute(tool: StudioTool, fields: Record<string, string>): string {
  if (tool === "charGen") return "codex/characters.md";
  if (tool === "worldGen") return fields.kind === "item" ? "codex/items.md" : "codex/world_lore.md";
  if (tool === "plotTwist") return "codex/plot_ideas.md";
  if (tool === "rephraseGen") return "replace selection";
  return "insert into scene";
}

async function routeOutput(tool: StudioTool, fields: Record<string, string>, text: string): Promise<string> {
  switch (tool) {
    case "charGen":
      return await appendToCodex("characters.md", fields.name || "New Character", text);
    case "worldGen": {
      const filename = fields.kind === "item" ? "items.md" : "world_lore.md";
      return await appendToCodex(filename, fields.subject || "New Lore Entry", text);
    }
    case "plotTwist": {
      const header = (fields.premise || "New Twist Set").split(/[.!?]/)[0];
      return await appendToCodex("plot_ideas.md", header, text);
    }
    case "rephraseGen":
      replaceSel(text);
      return "selection replaced";
    default:
      insert(text);
      return "scene updated";
  }
}

async function autoStateAndAudit(text: string, diagnostics?: ContinuityDiagnostics): Promise<void> {
  const auto = automationSettings();
  if (auto.autoApplyStatePatches) {
    const state = await loadState();
    const patches = proposeStatePatches(text, state);
    if (patches.length) await applyPatches(patches);
  }
  if (auto.autoAuditOnSave && diagnostics) {
    await diagnostics.runOnEditor();
  }
}

export async function assertContractReady(tool: StudioTool, force?: boolean): Promise<void> {
  const cfg = vscode.workspace.getConfiguration("novelStudio");
  if (!cfg.get<boolean>("contractGate") || force || tool !== "storyGen") return;
  const rel = currentDraftRel();
  if (!rel) return;
  const loaded = await loadContract(rel);
  const contract = loaded?.contract || (await ensureSceneContract(rel));
  if (!contractReady(contract)) {
    throw new Error("Scene contract incomplete. Fill the Contract tab or click Generate anyway.");
  }
}

export async function generateFromTool(
  text: TextRouter,
  keys: KeyManager,
  tool: StudioTool,
  fields: Record<string, string>,
  diagnostics?: ContinuityDiagnostics,
  onToken?: (chunk: string) => void,
  force?: boolean,
): Promise<{ output: string; route: string }> {
  await assertContractReady(tool, force);
  const prompt = assembleToolPrompt(tool, fields);
  if (!prompt.trim()) throw new Error("Fill at least one field before generating.");

  const system = `${await loadPrompt(tool === "rephraseGen" ? "rewrite" : "continue")}\n${TOOL_SYSTEM[tool]}`;
  const output = await generatePacked(text, keys, prompt, system, onToken);

  let route = describeRoute(tool, fields);
  const auto = automationSettings();
  if (auto.autoRouteSidebarOutput) {
    route = await routeOutput(tool, fields, output);
    await autoStateAndAudit(output, diagnostics);
  }

  return { output, route };
}
