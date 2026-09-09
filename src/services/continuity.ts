import { loadBible, unknownNames } from "./bible";
import { loadState } from "./stateMachine";

export interface ContinuityFlag {
  message: string;
  severity: "warning" | "information";
  matchText?: string;
}

export async function auditProse(prose: string): Promise<ContinuityFlag[]> {
  const flags: ContinuityFlag[] = [];
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
  }
  return flags;
}
