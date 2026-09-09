import { SceneContract } from "./contracts";

export interface ContractFlag {
  message: string;
  matchText?: string;
}

export function auditContract(prose: string, contract: SceneContract): ContractFlag[] {
  const flags: ContractFlag[] = [];
  const lower = prose.toLowerCase();
  for (const req of contract.mustInclude) {
    const needle = (req || "").trim();
    if (needle && !lower.includes(needle.toLowerCase())) {
      flags.push({ message: `Contract mustInclude missing: ${needle}` });
    }
  }
  for (const ban of contract.mustNot) {
    const needle = (ban || "").trim();
    if (needle && lower.includes(needle.toLowerCase())) {
      flags.push({ message: `Contract mustNot violated: ${needle}`, matchText: needle });
    }
  }
  return flags;
}
