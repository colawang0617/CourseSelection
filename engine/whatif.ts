import type { Analysis, Problem } from "./types";

export interface WhatIfDelta {
  gains: { credentialId: string; short: string; before: number; after: number; total: number }[];
  problems: Problem[];
  ok: boolean;
}

export function diffAnalysis(before: Analysis, after: Analysis): WhatIfDelta {
  const gains = after.credentials.map((cred) => {
    const prev = before.credentials.find((c) => c.id === cred.id);
    return {
      credentialId: cred.id,
      short: cred.short,
      before: prev?.filled ?? 0,
      after: cred.filled,
      total: cred.total,
    };
  });
  const prevKeys = new Set(before.problems.map((p) => `${p.code}:${p.message}`));
  const problems = after.problems.filter((p) => !prevKeys.has(`${p.code}:${p.message}`));
  const ok = problems.every((p) => p.severity !== "error");
  return { gains, problems, ok };
}
