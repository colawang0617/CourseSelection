import type { Analysis } from "@/engine/types";
import { joinList } from "@/lib/utils";

export function coversLine(analysis: Analysis, code: string) {
  return joinList(
    (analysis.countsFor[code] ?? []).map((use) => {
      const cred = analysis.credentials.find((item) => item.id === use.credentialId);
      return cred?.short ? `${cred.short} · ${use.label}` : use.label;
    }),
  );
}

export function fillsLine(fills: { short: string; label: string }[]) {
  return joinList(fills.map((fill) => (fill.short ? `${fill.short} · ${fill.label}` : fill.label)));
}
