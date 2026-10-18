import { HCI_DESIGN, HCI_SOCIETY, HCI_TECH } from "@/data/lists";
import type { CredentialDef } from "@/engine/types";

export const seHciSpec: CredentialDef = {
  id: "se-hci",
  name: "Human-Computer Interaction",
  short: "HCI",
  kind: "specialization",
  calendar: "2024-25",
  sharedWithMajor: ["CS349"],
  groups: [
    { id: "cs349", label: "User interfaces", need: 1, weight: 90, codes: ["CS349"] },
    { id: "cs449", label: "HCI methods", need: 1, weight: 90, codes: ["CS449"] },
    {
      id: "society",
      label: "Society",
      need: 1,
      weight: 60,
      codes: HCI_SOCIETY,
    },
    {
      id: "design",
      label: "Design",
      need: 2,
      weight: 60,
      codes: HCI_DESIGN,
    },
    {
      id: "tech",
      label: "Technical",
      need: 2,
      weight: 65,
      codes: HCI_TECH,
      maxFrom: [
        { n: 1, codes: ["CS445", "ECE451", "SE463"] },
        { n: 1, codes: ["CS446", "ECE452", "SE464"] },
        { n: 1, codes: ["CS447", "ECE453", "SE465"] },
        { n: 1, codes: ["CS453", "CS459"] },
      ],
    },
  ],
};
