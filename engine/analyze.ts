import { LISTS } from "@/data/lists";
import { allocate, eligible, type Assignment, type SolverCourse } from "./allocate";
import { levelIndex } from "./levels";
import { comboWarnings, type InvalidRow } from "./policies";
import { checkAntirequisite, checkRequisite } from "./prereq";
import { crossAliases, expandCodes as expand } from "./cross";
import { marginalGain } from "./suggest";
import type {
  Analysis,
  CatalogList,
  CourseRecord,
  CredentialDef,
  CredentialView,
  GroupView,
  OfferingBook,
  Problem,
  Profile,
  RequiredCourse,
  Suggestion,
} from "./types";

export interface AnalyzeInput {
  profile: Profile;
  credentials: CredentialDef[];
  placements: Record<string, string[]>;
  lists?: Record<string, CatalogList>;
  courses?: Record<string, Partial<CourseRecord>>;
  catalogs?: { since: string; courses: Record<string, Partial<CourseRecord>> }[];
  offerings?: OfferingBook;
  ratings?: Record<string, { liked: number | null }>;
  activeTermId?: string;
  /**
   * Only count transcript + plan courses in this term or earlier.
   * Used for “as of 3B” progress rings / open requirements.
   */
  asOfTermId?: string;
  query?: string;
  filterGroupId?: string;
  suggest?: boolean;
  invalidRows?: InvalidRow[];
  pins?: Record<string, string[]>;
}

interface Placed {
  code: string;
  termId: string;
  index: number;
  level: string;
  grade?: number;
  credits: number;
  status: "complete" | "planned" | "in-progress";
  subject: string;
  title: string;
  record: CourseRecord;
}

function blank(code: string, credits = 0.5): CourseRecord {
  const subject = code.match(/^[A-Z]+/)?.[0] ?? "";
  return {
    code,
    title: code,
    credits,
    subject,
    description: "",
    crossList: [],
    prerequisites: null,
    corequisites: null,
    antirequisites: null,
    prereqText: "",
    coreqText: "",
    antireqText: "",
  };
}

function mergeRecord(code: string, partial?: Partial<CourseRecord>, credits?: number): CourseRecord {
  return { ...blank(code, credits), ...partial, code };
}

function resolveCourse(
  input: AnalyzeInput,
  code: string,
  termId: string,
  credits?: number,
): CourseRecord {
  const catalogs = [...(input.catalogs ?? [])].sort((a, b) => a.since.localeCompare(b.since));
  let base: Partial<CourseRecord> | undefined;
  for (const cat of catalogs) {
    if (termId >= cat.since && cat.courses[code]) base = cat.courses[code];
  }
  if (!base) {
    for (const cat of catalogs) if (cat.courses[code]) base = cat.courses[code];
  }
  return mergeRecord(code, { ...base, ...input.courses?.[code] }, credits ?? base?.credits);
}

export { crossAliases } from "./cross";

export function offeringOf(
  book: OfferingBook | undefined,
  code: string,
  termId: string,
): "offered" | "absent" | "unknown" {
  if (!book || !book.postedTerms.includes(termId)) return "unknown";
  const value = book.courses[code]?.[termId];
  if (value === true) return "offered";
  if (value === false) return "absent";
  return "unknown";
}

function facultyOk(group: CredentialDef["groups"][number], courses: string[], cross: Map<string, Set<string>>) {
  for (const fac of group.facultyMin ?? []) {
    const set = new Set(fac.codes);
    const n = courses.filter((code) => {
      for (const a of cross.get(code) ?? [code]) if (set.has(a)) return true;
      return set.has(code);
    }).length;
    if (n < fac.n) return fac.label;
  }
  return null;
}

export function suggestedPlacements(profile: Profile, credentials: CredentialDef[]) {
  const taken = new Set(profile.transcript.map((t) => t.code));
  const out: Record<string, string[]> = {};
  for (const cred of credentials) {
    for (const [level, codes] of Object.entries(cred.suggestedLevel ?? {})) {
      const term = profile.terms.find(
        (t) => t.kind === "study" && t.level === level && t.status !== "past",
      );
      if (!term) continue;
      for (const code of codes) {
        if (taken.has(code)) continue;
        out[term.id] ??= [];
        if (!out[term.id].includes(code)) out[term.id].push(code);
      }
    }
  }
  return out;
}

export async function analyze(input: AnalyzeInput): Promise<Analysis> {
  const lists = input.lists ?? LISTS;
  const terms = input.profile.terms;
  const termById = new Map(terms.map((t, index) => [t.id, { ...t, index }]));
  const placed: Placed[] = [];
  const seen = new Set<string>();

  const add = (
    code: string,
    termId: string,
    status: Placed["status"],
    grade: number | null | undefined,
    credits?: number,
  ) => {
    if (seen.has(code)) return;
    seen.add(code);
    const term = termById.get(termId);
    if (!term) return;
    const record = resolveCourse(input, code, termId, credits);
    placed.push({
      code,
      termId,
      index: term.index,
      level: term.level,
      grade: grade ?? undefined,
      credits: credits ?? record.credits,
      status,
      subject: record.subject,
      title: record.title,
      record,
    });
  };

  for (const item of input.profile.transcript) {
    add(item.code, item.term, item.status, item.grade, item.credits);
  }
  for (const [termId, codes] of Object.entries(input.placements)) {
    for (const code of codes) add(code, termId, "planned", undefined, input.courses?.[code]?.credits);
  }

  /**
   * As-of progress (same for past and future focus terms):
   * courses through that term, plus fixed calendar-required work after it
   * (named cores + suggested sequence — you'll take those anyway).
   * Electives — even required ones like Comm / UI / NS — only count once
   * they're at or before the focus term, so 1A ≠ 1B when 1B adds an elective.
   */
  const asOf = input.asOfTermId != null ? termById.get(input.asOfTermId) : undefined;
  if (asOf) {
    injectRemainingSequenceRequired(input, asOf.index, add);
    const keepLater = fixedRequiredBeyondTerm(input, asOf.index, termById);
    for (let i = placed.length - 1; i >= 0; i--) {
      if (placed[i].index > asOf.index && !keepLater.has(placed[i].code)) placed.splice(i, 1);
    }
  }

  const cross = crossAliases(placed.map((p) => p.record));
  const solverCourses: SolverCourse[] = placed
    .filter((p) => p.status !== "in-progress")
    .map((p) => ({
      code: p.code,
      subject: p.subject,
      credits: p.credits,
      grade: p.grade,
      status: p.status === "planned" ? "planned" : "complete",
      level: p.level,
    }));

  const assignment = await allocate({
    courses: solverCourses,
    credentials: input.credentials,
    lists,
    cross,
    counting: input.profile.settings.counting,
    overrides: input.profile.overrides,
    pins: input.pins,
  });

  const planCodes = new Set(solverCourses.map((c) => c.code));
  const eligibleFor: NonNullable<Analysis["eligibleFor"]> = {};
  for (const course of solverCourses) {
    for (const cred of input.credentials) {
      for (const group of cred.groups) {
        if (!eligible(course, group, lists, cross, planCodes, input.profile.overrides)) continue;
        (eligibleFor[course.code] ??= []).push({
          credentialId: cred.id,
          groupId: group.id,
          label: group.label,
          overlap: group.overlap,
        });
      }
    }
  }

  const credentials: CredentialView[] = input.credentials.map((cred) => {
    const groups: GroupView[] = cred.groups.map((group) => {
      const courses = assignment
        .filter((a) => a.credentialId === cred.id && a.groupId === group.id)
        .map((a) => a.course);
      const missing = facultyOk(group, courses, cross);
      const satisfied = courses.length >= group.need && !missing;
      return {
        id: group.id,
        label: group.label,
        need: group.need,
        courses,
        satisfied,
        note: missing ? `Need a ${missing} course` : undefined,
      };
    });
    const total = groups.reduce((s, g) => s + g.need, 0);
    const filled = groups.reduce((s, g) => {
      if (g.satisfied) return s + g.need;
      const credit = Math.min(g.courses.length, g.need);
      return s + (g.note && g.courses.length >= g.need ? Math.max(0, g.need - 1) : credit);
    }, 0);
    return {
      id: cred.id,
      name: cred.name,
      short: cred.short,
      kind: cred.kind,
      filled,
      total,
      complete: groups.every((g) => g.satisfied),
      groups,
    };
  });

  const problems: Problem[] = [];
  const active = placed.filter((p) => p.status === "planned");
  for (const course of active) {
    const earlier = placed.filter((p) => p.index < course.index && p.code !== course.code);
    const same = placed.filter((p) => p.termId === course.termId && p.code !== course.code);
    const before = new Map<string, { grade?: number }>();
    for (const p of earlier) {
      for (const code of expand([p.code], cross)) before.set(code, { grade: p.grade });
    }
    const sameTerm = expand(
      same.map((p) => p.code),
      cross,
    );
    const ctx = {
      before,
      sameTerm,
      level: course.level,
      plan: input.profile.plan,
      average: averageOf(placed),
    };
    const skip = input.profile.overrides.some((o) => o.code === course.code && o.ignorePrereq);
    if (!skip) {
      const pre = checkRequisite(course.record.prerequisites, ctx);
      const co = checkRequisite(course.record.corequisites, ctx);
      for (const message of [...pre.reasons, ...co.reasons]) {
        problems.push({ code: course.code, termId: course.termId, severity: "error", message });
      }
      for (const message of [...pre.warnings, ...co.warnings]) {
        problems.push({ code: course.code, termId: course.termId, severity: "warn", message: `Check: ${message}` });
      }
    }
    const anti = checkAntirequisite(course.record.antirequisites, ctx);
    for (const message of anti.reasons) {
      problems.push({ code: course.code, termId: course.termId, severity: "error", message });
    }
    const offer = offeringOf(input.offerings, course.code, course.termId);
    if (offer === "absent") {
      problems.push({
        code: course.code,
        termId: course.termId,
        severity: "error",
        message: "Not offered",
      });
    }
  }

  for (const term of terms) {
    if (term.maxCourses == null || term.status === "past") continue;
    const load = placed.filter((p) => p.termId === term.id && p.credits > 0);
    if (load.length > term.maxCourses) {
      const extra = load[load.length - 1];
      problems.push({
        code: extra.code,
        termId: term.id,
        severity: "warn",
        message: `Overload: ${load.length} courses (normal load is ${term.maxCourses})`,
      });
    }
  }

  const comm = assignment.find((a) => a.groupId === "comm");
  if (comm) {
    const course = placed.find((p) => p.code === comm.course);
    if (course && levelIndex(course.level) >= levelIndex("3A")) {
      problems.push({
        code: course.code,
        termId: course.termId,
        severity: "error",
        message: "Finish this before 3A",
      });
    }
  }

  const countsFor: Analysis["countsFor"] = {};
  for (const a of assignment) {
    const cred = input.credentials.find((c) => c.id === a.credentialId);
    const group = cred?.groups.find((g) => g.id === a.groupId);
    countsFor[a.course] ??= [];
    countsFor[a.course].push({
      credentialId: a.credentialId,
      groupId: a.groupId,
      label: group?.label ?? a.groupId,
    });
  }

  const required = requiredCourses(input, assignment);

  const earned = placed
    .filter((p) => p.status === "complete" && p.subject !== "PD" && p.subject !== "COOP")
    .reduce((s, p) => s + p.credits, 0);
  const projected =
    earned +
    placed.filter((p) => p.status === "planned").reduce((s, p) => s + p.credits, 0);

  const target = input.credentials.find((c) => c.units != null)?.units ?? null;
  const offering: Analysis["offering"] = {};
  for (const course of active) offering[course.code] = offeringOf(input.offerings, course.code, course.termId);

  const suggestions =
    input.suggest === false
      ? []
      : buildSuggestions(input, placed, assignment, lists, cross);

  const done = new Set(placed.filter((p) => p.status === "complete").map((p) => p.code));
  const pdCore = ["PD10", "PD11", "PD19", "PD20"].filter((c) => done.has(c)).length;
  const pdExtra = [...done].filter((c) => c.startsWith("PD") && !["PD10", "PD11", "PD19", "PD20"].includes(c)).length;
  const workDone = [...done].filter((c) => c.startsWith("COOP")).length;

  return {
    units: { earned: round(earned), projected: round(projected), target },
    average: round(averageOf(placed)),
    credentials,
    problems,
    countsFor,
    suggestions,
    liked: Object.fromEntries(
      Object.entries(input.ratings ?? {})
        .filter((entry): entry is [string, { liked: number }] => entry[1].liked != null)
        .map(([code, info]) => [code, info.liked]),
    ),
    offering,
    titles: Object.fromEntries(placed.map((p) => [p.code, p.title])),
    eligibleFor,
    termOf: Object.fromEntries(placed.map((p) => [p.code, p.termId])),
    required,
    coop: {
      workDone: Math.min(5, workDone),
      workTarget: 5,
      pdDone: Math.min(5, pdCore + Math.min(1, pdExtra)),
      pdTarget: 5,
    },
    warnings: comboWarnings(input.credentials, input.invalidRows ?? []),
  };
}

/**
 * Open electives you freely choose — not the same as required electives
 * (User interfaces, Mechanics, Communication, …).
 */
function isOpenElective(group: {
  id: string;
  label: string;
  need: number;
  anyHalf?: boolean;
  listRef?: string;
  listRefs?: string[];
}): boolean {
  if (group.anyHalf) return true;
  if (group.id === "free" || group.id === "sustainability") return true;
  if (group.id.startsWith("te-") || group.id.startsWith("cse-")) return true;
  if (/^technical\b/i.test(group.label) || /^free elective/i.test(group.label)) return true;
  if (/^complementary\b/i.test(group.label)) return true;
  // Multi-pick list buckets (e.g. Natural science rest) are open choices, not a single required slot.
  if (group.need > 1 && (group.listRef || (group.listRefs?.length ?? 0) > 0)) return true;
  return false;
}

function isNamedCore(group: {
  need: number;
  codes?: string[];
  listRef?: string;
  listRefs?: string[];
  anyHalf?: boolean;
  subjects?: string[];
}): boolean {
  return (
    group.need === 1 &&
    (group.codes?.length ?? 0) === 1 &&
    !group.listRef &&
    !(group.listRefs?.length) &&
    !group.anyHalf &&
    !(group.subjects?.length)
  );
}

/** Assume remaining calendar sequence courses after the focus term (if not already planned). */
function injectRemainingSequenceRequired(
  input: Pick<AnalyzeInput, "profile" | "credentials" | "courses">,
  asOfIndex: number,
  add: (code: string, termId: string, status: Placed["status"], grade: number | null | undefined, credits?: number) => void,
) {
  const major = input.credentials.find((c) => c.kind === "major");
  if (!major?.suggestedLevel) return;
  for (const [level, codes] of Object.entries(major.suggestedLevel)) {
    const term = input.profile.terms.find((t) => t.kind === "study" && t.level === level);
    if (!term) continue;
    const index = input.profile.terms.indexOf(term);
    if (index <= asOfIndex) continue;
    for (const code of codes) {
      add(code, term.id, "planned", undefined, input.courses?.[code]?.credits);
    }
  }
}

/** Fixed calendar requirements after the focus term (sequence + named cores only). */
function fixedRequiredBeyondTerm(
  input: Pick<AnalyzeInput, "profile" | "credentials">,
  asOfIndex: number,
  termById: Map<string, { index: number }>,
): Set<string> {
  const keep = new Set<string>();
  const major = input.credentials.find((c) => c.kind === "major");
  if (!major) return keep;

  for (const [level, codes] of Object.entries(major.suggestedLevel ?? {})) {
    const term = input.profile.terms.find((t) => t.kind === "study" && t.level === level);
    if (!term || (termById.get(term.id)?.index ?? -1) <= asOfIndex) continue;
    for (const code of codes) keep.add(code);
  }
  for (const group of major.groups) {
    if (isNamedCore(group)) keep.add(group.codes![0]);
  }
  return keep;
}

/**
 * Degree-calendar required work: named cores, term sequence, and required electives
 * (slots you must fill from a constrained list — User interfaces, Mechanics, …).
 * Open technical/free electives are excluded.
 */
export function requiredCourses(
  input: Pick<AnalyzeInput, "profile" | "credentials">,
  assignment: { course: string; credentialId: string; groupId: string }[] = [],
): RequiredCourse[] {
  const major = input.credentials.find((c) => c.kind === "major");
  if (!major) return [];
  const out = new Map<string, RequiredCourse>();

  for (const [level, codes] of Object.entries(major.suggestedLevel ?? {})) {
    const term = input.profile.terms.find((t) => t.kind === "study" && t.level === level);
    for (const code of codes) {
      const group = major.groups.find((g) => g.codes?.length === 1 && g.codes[0] === code);
      out.set(code, {
        code,
        credentialId: major.id,
        kind: "sequence",
        label: group?.label ?? code,
        level,
        termId: term?.id,
      });
    }
  }

  for (const group of major.groups) {
    if (!isNamedCore(group)) continue;
    const code = group.codes![0];
    if (out.has(code)) continue;
    out.set(code, { code, credentialId: major.id, kind: "core", label: group.label });
  }

  // Courses currently filling a required-elective slot (e.g. PHYS121 → Mechanics, CS349 → UI).
  for (const a of assignment) {
    if (a.credentialId !== major.id || out.has(a.course)) continue;
    const group = major.groups.find((g) => g.id === a.groupId);
    if (!group || isOpenElective(group) || isNamedCore(group)) continue;
    out.set(a.course, {
      code: a.course,
      credentialId: major.id,
      kind: "choice",
      label: group.label,
    });
  }

  return [...out.values()];
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function averageOf(placed: Placed[]) {
  let points = 0;
  let credits = 0;
  for (const course of placed) {
    if (course.status !== "complete" || course.grade == null || course.credits <= 0) continue;
    points += course.grade * course.credits;
    credits += course.credits;
  }
  return credits ? points / credits : 0;
}

function newestCatalog(input: AnalyzeInput): Record<string, Partial<CourseRecord>> | undefined {
  const catalogs = [...(input.catalogs ?? [])].sort((a, b) => b.since.localeCompare(a.since));
  return catalogs[0]?.courses ?? input.courses;
}

function buildSuggestions(
  input: AnalyzeInput,
  placed: Placed[],
  assignment: Assignment[],
  lists: Record<string, CatalogList>,
  cross: Map<string, Set<string>>,
): Suggestion[] {
  const termId =
    input.activeTermId ??
    input.profile.terms.find((t) => t.kind === "study" && t.status === "future")?.id;
  if (!termId) return [];
  const term = input.profile.terms.find((t) => t.id === termId);
  if (!term) return [];
  if (!input.query && !input.filterGroupId) return [];
  const have = new Set(placed.map((p) => p.code));
  const pool = new Set<string>();
  const groups = input.credentials.flatMap((c) => c.groups);
  const focused = input.filterGroupId ? groups.filter((g) => g.id === input.filterGroupId) : groups;
  for (const group of focused) {
    for (const code of group.codes ?? []) pool.add(code);
    for (const ref of [...(group.listRef ? [group.listRef] : []), ...(group.listRefs ?? [])]) {
      for (const code of lists[ref]?.codes ?? []) pool.add(code);
    }
  }
  const searchIn = newestCatalog(input);
  const focusedGroup = input.filterGroupId ? groups.find((g) => g.id === input.filterGroupId) : undefined;
  const groupHasList = Boolean(
    focusedGroup &&
      ((focusedGroup.codes?.length ?? 0) > 0 || focusedGroup.listRef || (focusedGroup.listRefs?.length ?? 0) > 0),
  );
  if (input.query && searchIn && !groupHasList) {
    const q = input.query.toLowerCase().replace(/\s+/g, "");
    let added = 0;
    for (const [code, course] of Object.entries(searchIn)) {
      if (added > 40) break;
      const title = (course.title ?? "").toLowerCase();
      if (code.toLowerCase().includes(q) || title.replace(/\s+/g, "").includes(q)) {
        pool.add(code);
        added++;
      }
    }
  }
  if (input.filterGroupId) {
    const group = groups.find((g) => g.id === input.filterGroupId);
    const subjects = new Set<string>(group?.subjects ?? []);
    for (const ref of [...(group?.listRef ? [group.listRef] : []), ...(group?.listRefs ?? [])]) {
      for (const s of lists[ref]?.subjects ?? []) subjects.add(s);
    }
    if (subjects.size && searchIn) {
      let added = 0;
      for (const [code, course] of Object.entries(searchIn)) {
        if (added > 60) break;
        const subject = course.subject ?? code.match(/^[A-Z]+/)?.[0] ?? "";
        if (!subjects.has(subject)) continue;
        pool.add(code);
        added++;
      }
    }
  }

  const index = input.profile.terms.findIndex((t) => t.id === termId);
  const earlier = placed.filter((p) => p.index < index);
  const same = placed.filter((p) => p.termId === termId);
  const before = new Map<string, { grade?: number }>();
  for (const p of earlier) for (const code of expand([p.code], cross)) before.set(code, { grade: p.grade });
  const sameTerm = expand(
    same.map((p) => p.code),
    cross,
  );
  const planCodes = new Set(placed.map((p) => p.code));
  const out: Suggestion[] = [];

  for (const code of pool) {
    if (have.has(code)) continue;
    const record = resolveCourse(input, code, termId);
    const course: SolverCourse = {
      code,
      subject: record.subject,
      credits: record.credits,
      status: "planned",
      level: term.level,
    };
    const ctx = {
      before,
      sameTerm,
      level: term.level,
      plan: input.profile.plan,
      average: averageOf(placed),
    };
    const pre = checkRequisite(record.prerequisites, ctx);
    const co = checkRequisite(record.corequisites, ctx);
    const blocked = [...pre.reasons, ...co.reasons][0] ?? null;
    const gain = marginalGain(
      course,
      assignment,
      input.credentials,
      lists,
      cross,
      new Set([...planCodes, code]),
      input.profile.overrides,
      input.profile.settings.counting,
    );
    if (gain.gain === 0 && !input.query && !input.filterGroupId) continue;
    const liked = input.ratings?.[code]?.liked ?? null;
    out.push({
      code,
      title: record.title,
      gain: gain.gain,
      offering: offeringOf(input.offerings, code, termId),
      liked,
      blocked,
      groups: gain.groups.map((g) => g.label),
      fills: gain.groups.map((g) => ({
        short: input.credentials.find((c) => c.id === g.credentialId)?.short ?? "",
        label: g.label,
      })),
    });
  }

  const offerRank = (s: Suggestion) => (s.offering === "offered" ? 0 : s.offering === "unknown" ? 1 : 2);
  out.sort(
    (a, b) =>
      offerRank(a) - offerRank(b) ||
      Number(a.gain === 0) - Number(b.gain === 0) ||
      Number(Boolean(a.blocked)) - Number(Boolean(b.blocked)) ||
      a.code.localeCompare(b.code),
  );
  return out.slice(0, input.filterGroupId ? 160 : 30);
}
