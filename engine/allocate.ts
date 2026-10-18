import type { HighsSolution, LegacyHighs } from "highs";
import { LISTS } from "@/data/lists";
import type { CatalogList, CredentialDef, Override, SlotGroup } from "./types";
import { LAB_COMPANIONS, levelIndex } from "./levels";

export interface SolverCourse {
  code: string;
  subject: string;
  credits: number;
  grade?: number;
  status: "complete" | "planned";
  level: string;
}

export interface Assignment {
  course: string;
  credentialId: string;
  groupId: string;
}

let highsPromise: Promise<LegacyHighs> | null = null;

async function getHighs(): Promise<LegacyHighs> {
  if (!highsPromise) {
    const mod = await import("highs");
    const init = mod.default as () => Promise<LegacyHighs>;
    highsPromise = init();
  }
  return highsPromise;
}

function aliases(code: string, cross: Map<string, Set<string>>): Set<string> {
  return cross.get(code) ?? new Set([code]);
}

function hits(code: string, set: Set<string>, cross: Map<string, Set<string>>): boolean {
  for (const a of aliases(code, cross)) if (set.has(a)) return true;
  return false;
}

function groupCodes(group: SlotGroup, lists: Record<string, CatalogList>): Set<string> {
  const out = new Set<string>(group.codes ?? []);
  const refs = [...(group.listRef ? [group.listRef] : []), ...(group.listRefs ?? [])];
  for (const ref of refs) for (const code of lists[ref]?.codes ?? []) out.add(code);
  return out;
}

export function eligible(
  course: SolverCourse,
  group: SlotGroup,
  lists: Record<string, CatalogList>,
  cross: Map<string, Set<string>>,
  planCodes: Set<string>,
  overrides: Override[],
): boolean {
  const codes = groupCodes(group, lists);
  const excluded = new Set(group.exclude ?? []);
  for (const ref of [...(group.listRef ? [group.listRef] : []), ...(group.listRefs ?? [])]) {
    for (const code of lists[ref]?.exclude ?? []) excluded.add(code);
  }
  let matched = false;
  if (codes.size > 0 && hits(course.code, codes, cross)) matched = true;
  const subjects = group.subjects ?? [];
  for (const ref of [...(group.listRef ? [group.listRef] : []), ...(group.listRefs ?? [])]) {
    for (const s of lists[ref]?.subjects ?? []) subjects.push(s);
  }
  if (subjects.includes(course.subject) && !hits(course.code, excluded, cross)) matched = true;
  if (group.anyHalf && course.credits === 0.5) {
    if (!group.excludeSubjects?.includes(course.subject)) matched = true;
  }
  if (!matched) return false;
  if (group.credits != null && Math.abs(course.credits - group.credits) > 0.001) return false;
  if (
    group.minGrade != null &&
    course.status === "complete" &&
    course.grade != null &&
    course.grade < group.minGrade
  ) {
    return false;
  }
  if (group.notBeforeLevel) {
    const waived = overrides.some((o) => o.code === course.code && o.waiveNotBefore);
    if (!waived && levelIndex(course.level) < levelIndex(group.notBeforeLevel)) return false;
  }
  const lab = LAB_COMPANIONS[course.code];
  if (lab && !planCodes.has(lab)) return false;
  return true;
}

interface Var {
  name: string;
  course: string;
  credentialId: string;
  groupId: string;
  weight: number;
}

export async function allocate(opts: {
  courses: SolverCourse[];
  credentials: CredentialDef[];
  lists?: Record<string, CatalogList>;
  cross?: Map<string, Set<string>>;
  counting: "strict" | "relaxed";
  overrides?: Override[];
  /** course code -> "credentialId:groupId" keys the student chose; the course counts nowhere else. */
  pins?: Record<string, string[]>;
}): Promise<Assignment[]> {
  const lists = opts.lists ?? LISTS;
  const cross = opts.cross ?? new Map();
  const overrides = opts.overrides ?? [];
  const pins = opts.pins ?? {};
  const planCodes = new Set(opts.courses.map((c) => c.code));
  const major = opts.credentials.find((c) => c.kind === "major");

  const vars: Var[] = [];
  const byCourse = new Map<string, Var[]>();
  for (const course of opts.courses) {
    const pinned = pins[course.code] ? new Set(pins[course.code]) : null;
    for (const cred of opts.credentials) {
      for (const group of cred.groups) {
        if (pinned && !pinned.has(`${cred.id}:${group.id}`)) continue;
        if (!eligible(course, group, lists, cross, planCodes, overrides)) continue;
        const v: Var = {
          name: `x${vars.length}`,
          course: course.code,
          credentialId: cred.id,
          groupId: group.id,
          weight: group.weight,
        };
        vars.push(v);
        const list = byCourse.get(course.code) ?? [];
        list.push(v);
        byCourse.set(course.code, list);
      }
    }
  }
  if (vars.length === 0) return [];

  // Lexicographic priority: honour student pins, then fill the major, then everything else by weight.
  const otherTotal = vars.filter((v) => v.credentialId !== major?.id).reduce((s, v) => s + v.weight, 0) + 1;
  const majorBonus = otherTotal;
  const majorTotal = vars.filter((v) => v.credentialId === major?.id).length * (majorBonus + 100);
  const pinBonus = otherTotal + majorTotal;
  const score = (v: Var) =>
    v.weight + (v.credentialId === major?.id ? majorBonus : 0) + (pins[v.course] ? pinBonus : 0);

  const lines: string[] = ["Maximize", " obj:"];
  const binaries: string[] = [];
  const obj: string[] = vars.map((v) => `${score(v)} ${v.name}`);
  binaries.push(...vars.map((v) => v.name));

  const rows: string[] = [];
  let rid = 0;
  const row = (body: string) => {
    rows.push(` r${rid++}: ${body}`);
  };

  for (const cred of opts.credentials) {
    for (const group of cred.groups) {
      const mine = vars.filter((v) => v.credentialId === cred.id && v.groupId === group.id);
      if (mine.length === 0) continue;
      row(`${mine.map((v) => v.name).join(" + ")} <= ${group.need}`);
      for (const cap of group.maxFrom ?? []) {
        const set = new Set(cap.codes);
        const capped = mine.filter((v) => hits(v.course, set, cross));
        if (capped.length) row(`${capped.map((v) => v.name).join(" + ")} <= ${cap.n}`);
      }
      for (const fac of group.facultyMin ?? []) {
        const set = new Set(fac.codes);
        const mineFac = mine.filter((v) => hits(v.course, set, cross));
        if (mineFac.length === 0) continue;
        const y = `y${binaries.length}`;
        binaries.push(y);
        obj.push(`0.05 ${y}`);
        row(`${y} - ${mineFac.map((v) => v.name).join(" - ")} <= 0`);
      }
    }
  }

  for (const [code, mine] of byCourse) {
    for (const cred of opts.credentials) {
      const inCred = mine.filter((v) => v.credentialId === cred.id);
      const exclusive = inCred.filter((v) => {
        const g = cred.groups.find((gg) => gg.id === v.groupId);
        return !g?.overlap;
      });
      if (exclusive.length > 1) row(`${exclusive.map((v) => v.name).join(" + ")} <= 1`);
      const overlap = inCred.filter((v) => {
        const g = cred.groups.find((gg) => gg.id === v.groupId);
        return g?.overlap;
      });
      for (const v of overlap) row(`${v.name} <= 1`);
    }

    if (opts.counting === "relaxed") continue;
    const credIds = [...new Set(mine.map((v) => v.credentialId))];
    if (credIds.length === 0) continue;
    const u: Record<string, string> = {};
    for (const id of credIds) {
      const name = `u${binaries.length}`;
      binaries.push(name);
      u[id] = name;
      const xs = mine.filter((v) => v.credentialId === id).map((v) => v.name);
      for (const x of xs) row(`${name} - ${x} >= 0`);
    }
    let merge = "";
    if (major) {
      for (const cred of opts.credentials) {
        if (!cred.sharedWithMajor?.includes(code)) continue;
        if (!u[major.id] || !u[cred.id]) continue;
        const m = `m${binaries.length}`;
        binaries.push(m);
        row(`${m} - ${u[major.id]} <= 0`);
        row(`${m} - ${u[cred.id]} <= 0`);
        merge = ` - ${m}`;
      }
    }
    row(`${credIds.map((id) => u[id]).join(" + ")}${merge} <= 2`);
  }

  lines.push(obj.join(" + "));
  lines.push("Subject To", ...rows, "Bounds");
  for (const name of binaries) lines.push(` 0 <= ${name} <= 1`);
  lines.push("Binary", binaries.join("\n"), "End");

  const highs = await getHighs();
  const solved: HighsSolution = highs.solve(lines.join("\n"), { mip_rel_gap: 0, mip_abs_gap: 0.01 });
  if (solved.Status !== "Optimal") {
    throw new Error(`Solver status ${solved.Status}`);
  }
  const chosen: Assignment[] = [];
  for (const v of vars) {
    const primal = solved.Columns[v.name]?.Primal ?? 0;
    if (primal >= 0.5) {
      chosen.push({ course: v.course, credentialId: v.credentialId, groupId: v.groupId });
    }
  }
  return chosen;
}
