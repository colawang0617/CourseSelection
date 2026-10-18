import { eligible, type Assignment, type SolverCourse } from "./allocate";
import type { CatalogList, CredentialDef, Override } from "./types";

export function countUses(
  credIds: Set<string>,
  code: string,
  credentials: CredentialDef[],
): number {
  const major = credentials.find((c) => c.kind === "major");
  let n = credIds.size;
  if (major && credIds.has(major.id)) {
    for (const cred of credentials) {
      if (!credIds.has(cred.id)) continue;
      if (cred.sharedWithMajor?.includes(code)) n -= 1;
    }
  }
  return n;
}

/** How many still-open requirement slots this course would fill. */
export function marginalGain(
  course: SolverCourse,
  assignment: Assignment[],
  credentials: CredentialDef[],
  lists: Record<string, CatalogList>,
  cross: Map<string, Set<string>>,
  planCodes: Set<string>,
  overrides: Override[],
  counting: "strict" | "relaxed",
): { gain: number; groups: { credentialId: string; groupId: string; label: string }[] } {
  const taken = new Map<string, Set<string>>();
  const used = new Set<string>();
  for (const a of assignment) {
    if (a.course !== course.code) {
      const key = `${a.credentialId}:${a.groupId}`;
      const set = taken.get(key) ?? new Set<string>();
      set.add(a.course);
      taken.set(key, set);
    } else {
      used.add(a.credentialId);
    }
  }
  const groups = credentials
    .flatMap((cred) => cred.groups.map((group) => ({ cred, group })))
    .sort(
      (a, b) =>
        Number(b.cred.kind === "major") - Number(a.cred.kind === "major") || b.group.weight - a.group.weight,
    );

  const filled: { credentialId: string; groupId: string; label: string }[] = [];
  const creds = new Set(used);
  const blockedIn = new Set<string>();
  for (const a of assignment) {
    if (a.course !== course.code) continue;
    const cred = credentials.find((c) => c.id === a.credentialId);
    const group = cred?.groups.find((g) => g.id === a.groupId);
    if (group && !group.overlap) blockedIn.add(a.credentialId);
  }

  for (const { cred, group } of groups) {
    const key = `${cred.id}:${group.id}`;
    const have = taken.get(key)?.size ?? 0;
    if (have >= group.need) continue;
    if (!eligible(course, group, lists, cross, planCodes, overrides)) continue;
    if (blockedIn.has(cred.id) && !group.overlap) continue;
    const next = new Set(creds);
    next.add(cred.id);
    if (counting === "strict" && countUses(next, course.code, credentials) > 2) continue;
    filled.push({ credentialId: cred.id, groupId: group.id, label: group.label });
    creds.add(cred.id);
    if (!group.overlap) blockedIn.add(cred.id);
    taken.set(key, new Set([...(taken.get(key) ?? []), course.code]));
  }
  return { gain: filled.length, groups: filled };
}
