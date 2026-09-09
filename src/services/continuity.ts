import { loadBible, unknownNameHits } from "./bible";
import { loadState } from "./stateMachine";

export interface ContinuityFlag {
  message: string;
  severity: "warning" | "information";
  start: number;
  end: number;
}

export async function auditProse(prose: string): Promise<ContinuityFlag[]> {
  const flags: ContinuityFlag[] = [];
  const bible = await loadBible();
  for (const hit of unknownNameHits(prose, bible)) {
    flags.push({
      message: `Unknown proper name vs bible: ${hit.name}`,
      severity: "warning",
      start: hit.index,
      end: hit.index + hit.name.length,
    });
  }
  const state = await loadState();
  for (const c of state.characters) {
    if ((c.status || "").toLowerCase().includes("dead")) {
      const escaped = c.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const speaks = new RegExp(`\\b${escaped}\\s+(said|asks|whispered|smiled)\\b`, "i");
      const match = speaks.exec(prose);
      if (match && match.index !== undefined) {
        flags.push({
          message: `${c.name} is marked dead in state.json but speaks.`,
          severity: "warning",
          start: match.index,
          end: match.index + match[0].length,
        });
      }
    }
  }
  return flags;
}
