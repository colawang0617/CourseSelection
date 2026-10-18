import { CO_UPPER } from "@/data/lists";
import type { CredentialDef } from "@/engine/types";

export const coMinor: CredentialDef = {
  id: "co-minor",
  name: "Combinatorics and Optimization",
  short: "C&O",
  kind: "minor",
  calendar: "2024-25",
  groups: [
    {
      id: "intro",
      label: "Optimization",
      need: 1,
      weight: 90,
      codes: ["CO250", "CO255"],
    },
    {
      id: "upper",
      label: "Upper CO",
      need: 3,
      weight: 80,
      codes: CO_UPPER,
    },
    {
      id: "linalg",
      label: "Linear algebra",
      need: 1,
      weight: 40,
      codes: ["MATH103", "MATH106", "MATH114", "MATH115", "MATH136", "MATH146"],
    },
    {
      id: "calc",
      label: "Calculus",
      need: 1,
      weight: 40,
      codes: ["MATH104", "MATH116", "MATH117", "MATH127", "MATH137", "MATH147"],
    },
    {
      id: "algebra",
      label: "Algebra",
      need: 1,
      weight: 40,
      codes: ["MATH135", "MATH145"],
    },
    {
      id: "combo",
      label: "Combinatorics",
      need: 1,
      weight: 40,
      codes: ["MATH239", "MATH249"],
    },
  ],
};
