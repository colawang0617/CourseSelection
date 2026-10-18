import type { CredentialDef } from "@/engine/types";
import { coMinor } from "./co-minor";
import { fixtureCs, fixtureStats } from "./fixtures";
import { seAiSpec } from "./se-ai-spec";
import { seHciSpec } from "./se-hci-spec";
import { seMajor2024 } from "./se-major-2024";

export const CREDENTIALS: Record<string, CredentialDef> = {
  [seMajor2024.id]: seMajor2024,
  [seAiSpec.id]: seAiSpec,
  [seHciSpec.id]: seHciSpec,
  [coMinor.id]: coMinor,
  [fixtureCs.id]: fixtureCs,
  [fixtureStats.id]: fixtureStats,
};

export function credentialsFor(ids: string[]): CredentialDef[] {
  return ids.map((id) => {
    const found = CREDENTIALS[id];
    if (!found) throw new Error(`Unknown credential ${id}`);
    return found;
  });
}
