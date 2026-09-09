import { loadBible, unknownNames } from "./bible";
import { loadState } from "./stateMachine";
import { currentDraftRel, loadContract } from "./contracts";
import { auditContract } from "./contractAudit";
import { listMarkdown } from "./workspaceIo";
import { draftSortKey, parseFrontmatter } from "./frontmatter";
import { loadStudioConfig } from "./studioConfig";
import { filterWordHits, overlapScore } from "./proseStats";
import * as vscode from "vscode";

export interface ContinuityFlag {
  message: string;
  severity: "warning" | "information";
  matchText?: string;
}

function povFlags(prose: string, pov: string): ContinuityFlag[] {
  const flags: ContinuityFlag[] = [];
  if (pov === "first") {
    if (!/\bI\b|\bme\b|\bmy\b/i.test(prose)) {
      flags.push({
        message: "studio.json POV is first person but prose lacks I/me/my.",
        severity: "information",
      });
    }
  } else if (pov === "third") {
    const m = /\bI\s+(said|thought|felt|saw|heard)\b/i.exec(prose);
    if (m) {
      flags.push({
        message: "studio.json POV is third person but prose uses first-person narration.",
        severity: "warning",
        matchText: m[0],
      });
    }
  }
  return flags;
}

function tenseFlags(prose: string, tense: string): ContinuityFlag[] {
  if (tense !== "past") return [];
  const flags: ContinuityFlag[] = [];
  const present = /\b(is|are|am)\s+\w+ing\b/gi;
  let m: RegExpExecArray | null;
  let count = 0;
  while ((m = present.exec(prose)) && count < 3) {
    flags.push({
      message: `Possible present tense (${m[0]}) while studio.json tense is past.`,
      severity: "information",
      matchText: m[0],
    });
    count++;
  }
  return flags;
}

async function crossChapterFlags(prose: string, currentRel?: string): Promise<ContinuityFlag[]> {
  const cfg = vscode.workspace.getConfiguration("novelStudio");
  if (!cfg.get<boolean>("crossChapterAudit")) return [];
  if (!currentRel) return [];

  const drafts = (await listMarkdown()).filter(
    (f) => f.rel.startsWith("drafts/") && !f.rel.includes("/contracts/"),
  );
  const currentOrder = draftSortKey(currentRel, prose);

  const prior = drafts
    .filter((f) => f.rel !== currentRel && draftSortKey(f.rel, f.text) < currentOrder)
    .sort((a, b) => draftSortKey(a.rel, a.text) - draftSortKey(b.rel, b.text));

  const flags: ContinuityFlag[] = [];
  const state = await loadState();

  for (const c of state.characters) {
    if (!(c.status || "").toLowerCase().includes("dead")) continue;
    for (const ch of prior) {
      const speaks = new RegExp(`\\b${c.name}\\s+(said|asks|whispered|smiled|laughed)\\b`, "i");
      const m = speaks.exec(ch.text);
      if (m) {
        flags.push({
          message: `${c.name} is dead in state but appears alive in earlier chapter ${ch.rel}.`,
          severity: "warning",
          matchText: m[0],
        });
      }
    }
  }

  const codex = (await listMarkdown()).filter((f) => f.rel.startsWith("codex/"));
  for (const file of codex) {
    for (const m of file.text.matchAll(/^#{1,3}\s+(.+)$/gm)) {
      const heading = m[1].trim();
      if (heading.length < 4) continue;
      const score = overlapScore(prose, heading);
      if (score > 0.65 && prose.toLowerCase().includes(heading.toLowerCase().slice(0, 12))) {
        flags.push({
          message: `High overlap with codex heading "${heading}" in ${file.rel} — possible repetition.`,
          severity: "information",
          matchText: heading,
        });
        break;
      }
    }
  }

  return flags;
}

export async function auditProse(prose: string): Promise<ContinuityFlag[]> {
  const flags: ContinuityFlag[] = [];
  const studio = await loadStudioConfig();

  if (studio.banned?.length) {
    for (const w of filterWordHits(prose, studio.banned)) {
      flags.push({
        message: `Banned word from studio.json: ${w}`,
        severity: "warning",
        matchText: w,
      });
    }
  }

  if (studio.pov) flags.push(...povFlags(prose, studio.pov.toLowerCase()));
  if (studio.tense) flags.push(...tenseFlags(prose, studio.tense.toLowerCase()));

  const bible = await loadBible();
  for (const n of unknownNames(prose, bible)) {
    flags.push({
      message: `Unknown proper name vs bible: ${n}`,
      severity: "warning",
      matchText: n,
    });
  }

  const state = await loadState();
  for (const c of state.characters) {
    if ((c.status || "").toLowerCase().includes("dead")) {
      const speaks = new RegExp(`\\b${c.name}\\s+(said|asks|whispered|smiled)\\b`, "i");
      const m = speaks.exec(prose);
      if (m) {
        flags.push({
          message: `${c.name} is marked dead in state.json but speaks.`,
          severity: "warning",
          matchText: m[0],
        });
      }
    }
    if (c.location && c.location !== "unknown") {
      const loc = c.location.toLowerCase();
      const here = new RegExp(`\\b${c.name}\\b[^.]{0,80}\\b(in|at)\\s+([\\w' -]+)`, "i").exec(prose);
      if (here && !here[2].toLowerCase().includes(loc.slice(0, 6))) {
        flags.push({
          message: `${c.name} is in ${c.location} per state but prose suggests ${here[2].trim()}.`,
          severity: "information",
          matchText: here[0],
        });
      }
    }
  }

  const rel = currentDraftRel();
  if (rel) {
    const loaded = await loadContract(rel);
    if (loaded) {
      for (const f of auditContract(prose, loaded.contract)) {
        flags.push({ message: f.message, severity: "warning", matchText: f.matchText });
      }
    }
    const { meta } = parseFrontmatter(prose);
    if (meta.status === "final" && prose.length < 400) {
      flags.push({
        message: "Chapter marked final but body is very short.",
        severity: "information",
      });
    }
  }

  flags.push(...(await crossChapterFlags(prose, rel)));
  return flags;
}
