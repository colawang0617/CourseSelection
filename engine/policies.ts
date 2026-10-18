import type { CredentialDef } from "./types";

export interface InvalidRow {
  plan: string;
  cannot: string;
}

function matches(side: string, cred: CredentialDef): boolean {
  const name = cred.name.toLowerCase();
  return side
    .toLowerCase()
    .split(";")
    .some((clause) => {
      const head = clause
        .replace(/\([^)]*\)/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!head.startsWith(name)) return false;
      const rest = head.slice(name.length);
      if (cred.kind === "minor") return /\bminor\b/.test(rest);
      if (cred.kind === "specialization") return /\bspecialization\b/.test(rest);
      if (cred.kind === "option") return /\boption\b/.test(rest);
      return !/\b(minor|specialization|option)\b/.test(rest);
    });
}

/** Warn when two declared credentials are an invalid combination. */
export function comboWarnings(credentials: CredentialDef[], rows: InvalidRow[]): string[] {
  const warnings: string[] = [];
  for (let i = 0; i < credentials.length; i++) {
    for (let j = i + 1; j < credentials.length; j++) {
      const a = credentials[i];
      const b = credentials[j];
      const hit = rows.some(
        (row) =>
          (matches(row.plan, a) && matches(row.cannot, b)) ||
          (matches(row.plan, b) && matches(row.cannot, a)),
      );
      if (hit) warnings.push(`${a.short} can't be combined with ${b.short}`);
    }
  }
  return warnings;
}
