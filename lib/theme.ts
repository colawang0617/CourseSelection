export interface Accent {
  solid: string;
  soft: string;
  text: string;
}

const PALETTE = {
  blue: { solid: "#2f6bff", soft: "#eaf0ff", text: "#1d4fd6" },
  violet: { solid: "#7c4dff", soft: "#f1ebff", text: "#5b2fd6" },
  pink: { solid: "#e8458b", soft: "#fdebf3", text: "#b8266a" },
  teal: { solid: "#14b8a6", soft: "#e2f7f4", text: "#0f766e" },
  amber: { solid: "#f59e0b", soft: "#fff4dc", text: "#a15c00" },
} satisfies Record<string, Accent>;

const SPECIALIZATION_ORDER = [PALETTE.violet, PALETTE.pink, PALETTE.teal];
const MINOR_ORDER = [PALETTE.amber, PALETTE.teal, PALETTE.pink];

/** Accent for a credential, assigned by kind and order so the colors stay stable for a profile. */
export function programAccent(
  credentials: { id: string; kind: "major" | "minor" | "specialization" | "option" }[],
  id: string,
): Accent {
  const cred = credentials.find((c) => c.id === id);
  if (!cred || cred.kind === "major") return PALETTE.blue;
  if (cred.kind === "minor") {
    const minors = credentials.filter((c) => c.kind === "minor");
    return MINOR_ORDER[minors.indexOf(cred) % MINOR_ORDER.length];
  }
  const others = credentials.filter((c) => c.kind === "specialization" || c.kind === "option");
  return SPECIALIZATION_ORDER[others.indexOf(cred) % SPECIALIZATION_ORDER.length];
}

export const spring = { type: "spring", stiffness: 420, damping: 32, mass: 0.8 } as const;
