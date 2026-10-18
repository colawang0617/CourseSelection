import type { CredentialDef } from "@/engine/types";

export const fixtureCs: CredentialDef = {
  id: "fixture-cs",
  name: "Computer Science",
  short: "CS",
  kind: "major",
  calendar: "2024-25",
  units: 20,
  groups: [
    { id: "cs135", label: "Intro course", need: 1, weight: 100, codes: ["CS135"] },
    {
      id: "free",
      label: "Elective",
      need: 1,
      weight: 10,
      anyHalf: true,
      excludeSubjects: ["PD", "COOP"],
    },
  ],
};

export const fixtureStats: CredentialDef = {
  id: "fixture-stats",
  name: "Statistics Minor",
  short: "Stat",
  kind: "minor",
  calendar: "2024-25",
  groups: [
    { id: "stat230", label: "Probability", need: 1, weight: 90, codes: ["STAT230"] },
  ],
};
