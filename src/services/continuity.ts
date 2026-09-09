import { loadBible } from "./bible";
import { loadState } from "./stateMachine";
import { findUnknownNames } from "../core/names";

export interface ContinuityFlag {
  message: string;
  severity: "warning" | "information";
  /** Offset of the offending text in the audited document, when known. */
  index?: number;
  length?: number;
}

export async function auditProse(prose: string): Promise<ContinuityFlag[]> {
  const flags: ContinuityFlag[] = [];

  const bible = await loadBible();
  const seen = new Set<string>();
  for (const match of findUnknownNames(prose, bible)) {
    if (seen.has(match.name)) continue;
    seen.add(match.name);
    flags.push({
      message: `Unknown proper name vs bible: ${match.name}`,
      severity: "warning",
      index: match.index,
      length: match.length,
    });
  }

  const state = await loadState();
  for (const c of state.characters) {
    if (!(c.status || "").toLowerCase().includes("dead")) continue;
    const speaks = new RegExp(
      `\\b${c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(said|says|asks|asked|whispered|smiled|replied)\\b`,
      "i",
    );
    const m = speaks.exec(prose);
    if (m) {
      flags.push({
        message: `${c.name} is marked dead in state.json but speaks.`,
        severity: "warning",
        index: m.index,
        length: m[0].length,
      });
    }
  }

  return flags;
}
