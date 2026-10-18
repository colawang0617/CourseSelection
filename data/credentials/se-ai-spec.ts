import { AI_ENG, AI_LIST, AI_MATH } from "@/data/lists";
import type { CredentialDef } from "@/engine/types";

export const seAiSpec: CredentialDef = {
  id: "se-ai",
  name: "Artificial Intelligence",
  short: "AI",
  kind: "specialization",
  calendar: "2024-25",
  sharedWithMajor: ["SE380"],
  groups: [
    {
      id: "cs486",
      label: "Artificial intelligence",
      need: 1,
      weight: 90,
      codes: ["CS486"],
    },
    {
      id: "cs492",
      label: "Social implications",
      need: 1,
      weight: 90,
      codes: ["CS492"],
    },
    {
      id: "ml",
      label: "Machine learning",
      need: 1,
      weight: 85,
      codes: ["CS480", "CS485"],
    },
    {
      id: "ai-list",
      label: "AI elective",
      need: 4,
      weight: 70,
      codes: AI_LIST,
      facultyMin: [
        { label: "Mathematics", n: 1, codes: AI_MATH },
        { label: "Engineering", n: 1, codes: AI_ENG },
      ],
    },
  ],
};
