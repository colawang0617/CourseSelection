import type { AnalyzeInput } from "./analyze";
import { offeringOf } from "./analyze";
import type { Assignment, SolverCourse } from "./allocate";
import { expandCodes } from "./cross";
import { newestCatalog, resolveCourseForInput } from "./course-resolve";
import { averageOfPlaced, buildAssignment, buildPlaced, type PlacedCourse } from "./placed";
import { codesForGroup, courseLevel, extendPoolForGroup, poolFromQuery } from "./pool";
import { checkRequisite } from "./prereq";
import { marginalGain } from "./suggest";
import type { BrowseFilters, BrowseRow, CatalogList } from "./types";

export interface BrowseInput extends AnalyzeInput {
  targetTermId: string;
}

function termLabel(input: BrowseInput, termId: string) {
  return input.profile.terms.find((t) => t.id === termId)?.label ?? termId;
}

function statusFor(
  input: BrowseInput,
  code: string,
  placed: PlacedCourse[],
): BrowseRow["status"] {
  const taken = input.profile.transcript.find((t) => t.code === code);
  if (taken) {
    return {
      kind: "taken",
      termId: taken.term,
      termLabel: termLabel(input, taken.term),
      grade: taken.grade,
    };
  }
  for (const [termId, codes] of Object.entries(input.placements)) {
    if (codes.includes(code)) {
      return { kind: "planned", termId, termLabel: termLabel(input, termId) };
    }
  }
  return { kind: "available" };
}

function evaluateRow(
  input: BrowseInput,
  code: string,
  termId: string,
  placed: PlacedCourse[],
  assignment: Assignment[],
  lists: Record<string, CatalogList>,
  cross: Map<string, Set<string>>,
  planCodes: Set<string>,
): BrowseRow | null {
  const term = input.profile.terms.find((t) => t.id === termId);
  if (!term) return null;
  const record = resolveCourseForInput(input, code, termId);
  const index = input.profile.terms.findIndex((t) => t.id === termId);
  const earlier = placed.filter((p) => p.index < index);
  const same = placed.filter((p) => p.termId === termId);
  const before = new Map<string, { grade?: number }>();
  for (const p of earlier) for (const c of expandCodes([p.code], cross)) before.set(c, { grade: p.grade });
  const sameTerm = expandCodes(
    same.map((p) => p.code),
    cross,
  );
  const ctx = {
    before,
    sameTerm,
    level: term.level,
    plan: input.profile.plan,
    average: averageOfPlaced(placed),
  };
  const pre = checkRequisite(record.prerequisites, ctx);
  const co = checkRequisite(record.corequisites, ctx);
  const blocked = [...pre.reasons, ...co.reasons][0] ?? null;
  const course: SolverCourse = {
    code,
    subject: record.subject,
    credits: record.credits,
    status: "planned",
    level: term.level,
  };
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
  const futureTerms = input.profile.terms.filter((t) => t.kind === "study" && t.status !== "past");
  const offeringByTerm: BrowseRow["offeringByTerm"] = {};
  for (const t of futureTerms) offeringByTerm[t.id] = offeringOf(input.offerings, code, t.id);

  return {
    code,
    title: record.title,
    credits: record.credits,
    offering: offeringOf(input.offerings, code, termId),
    offeringByTerm,
    blocked,
    liked: input.ratings?.[code]?.liked ?? null,
    gain: gain.gain,
    fills: gain.groups.map((g) => ({
      short: input.credentials.find((c) => c.id === g.credentialId)?.short ?? "",
      label: g.label,
    })),
    status: statusFor(input, code, placed),
  };
}

function applyFilters(rows: BrowseRow[], filters: BrowseFilters | undefined, targetTermId: string) {
  let out = rows;
  if (filters?.offeredOnly) out = out.filter((r) => r.offering === "offered");
  if (filters?.prereqsMet) out = out.filter((r) => !r.blocked);
  if (filters?.hideTakenPlanned) out = out.filter((r) => r.status.kind === "available");
  if (filters?.subject) out = out.filter((r) => r.code.startsWith(filters.subject!));
  if (filters?.levelMin != null) out = out.filter((r) => courseLevel(r.code) >= filters.levelMin!);
  if (filters?.levelMax != null) out = out.filter((r) => courseLevel(r.code) <= filters.levelMax!);
  const sort = filters?.sort ?? "fit";
  const readiness = (r: BrowseRow) => {
    if (r.status.kind !== "available") return 5;
    if (r.offering === "absent") return 4;
    const unknown = r.offering === "unknown" ? 1 : 0;
    return (r.blocked ? 2 : 0) + unknown;
  };
  out = [...out].sort((a, b) => {
    if (sort === "code") return a.code.localeCompare(b.code);
    if (sort === "liked") return (b.liked ?? -1) - (a.liked ?? -1) || a.code.localeCompare(b.code);
    return readiness(a) - readiness(b) || b.gain - a.gain || a.code.localeCompare(b.code);
  });
  void targetTermId;
  return out;
}

function findGroup(input: BrowseInput, groupId: string) {
  for (const cred of input.credentials) {
    const group = cred.groups.find((g) => g.id === groupId);
    if (group) return { cred, group };
  }
  return null;
}

const LIST_HARD_CAP = 500;

function rowsForPool(
  input: BrowseInput,
  pool: Iterable<string>,
  placed: PlacedCourse[],
  assignment: Assignment[],
  lists: Record<string, CatalogList>,
  cross: Map<string, Set<string>>,
  filters?: BrowseFilters,
): BrowseRow[] {
  const planCodes = new Set(placed.map((p) => p.code));
  const rows: BrowseRow[] = [];
  for (const code of pool) {
    const row = evaluateRow(
      input,
      code,
      input.targetTermId,
      placed,
      assignment,
      lists,
      cross,
      planCodes,
    );
    if (row) rows.push(row);
  }
  return applyFilters(rows, filters, input.targetTermId);
}

export async function browseGroup(
  input: BrowseInput,
  groupId: string,
  filters?: BrowseFilters,
  limit = 400,
): Promise<{ header: string; rows: BrowseRow[]; truncated: boolean; subjects: string[] }> {
  const placed = buildPlaced(input);
  const { assignment, cross, lists } = await buildAssignment(input, placed);
  const found = findGroup(input, groupId);
  if (!found) return { header: groupId, rows: [], truncated: false, subjects: [] };
  const { cred, group } = found;
  const pool = codesForGroup(group, lists);
  extendPoolForGroup(input, group, lists, pool);
  const filtered = rowsForPool(input, pool, placed, assignment, lists, cross, filters);
  const truncated = pool.size > LIST_HARD_CAP || filtered.length > limit;
  const header = `${cred.short} · ${group.label}: complete ${group.need} of the following`;
  const page = filtered.slice(0, limit);
  return { header, rows: page, truncated, subjects: subjectsOf(page) };
}

/** Browse a raw catalog list (not tied to a credential group). */
export async function browseList(
  input: BrowseInput,
  listId: string,
  filters?: BrowseFilters,
  limit = LIST_HARD_CAP,
): Promise<{ header: string; rows: BrowseRow[]; truncated: boolean; subjects: string[] }> {
  const placed = buildPlaced(input);
  const { assignment, cross, lists } = await buildAssignment(input, placed);
  const list = lists[listId];
  if (!list) return { header: listId, rows: [], truncated: false, subjects: [] };

  const pool = new Set<string>(list.codes ?? []);
  const exclude = new Set(list.exclude ?? []);
  if (list.subjects?.length) {
    const searchIn = newestCatalog(input);
    if (searchIn) {
      let added = 0;
      for (const [code, course] of Object.entries(searchIn)) {
        if (added > LIST_HARD_CAP) break;
        if (exclude.has(code)) continue;
        const subject = course.subject ?? code.match(/^[A-Z]+/)?.[0] ?? "";
        if (!list.subjects.includes(subject)) continue;
        pool.add(code);
        added++;
      }
    }
  }
  for (const code of exclude) pool.delete(code);

  const filtered = rowsForPool(input, pool, placed, assignment, lists, cross, filters);
  const truncated = pool.size > LIST_HARD_CAP || filtered.length > limit;
  const page = filtered.slice(0, limit);
  return {
    header: listId,
    rows: page,
    truncated,
    subjects: subjectsOf(page),
  };
}

export async function browseCatalog(
  input: BrowseInput,
  query: string,
  filters: BrowseFilters | undefined,
  offset: number,
  limit: number,
): Promise<{ rows: BrowseRow[]; total: number; needQuery?: boolean; subjects: string[] }> {
  const q = query.trim();
  if (q.length < 2) {
    return { rows: [], total: 0, needQuery: true, subjects: [] };
  }

  const placed = buildPlaced(input);
  const { assignment, cross, lists } = await buildAssignment(input, placed);
  const pool = new Set<string>();
  poolFromQuery(input, q, pool, 500);
  const filtered = rowsForPool(input, pool, placed, assignment, lists, cross, filters);
  const page = filtered.slice(offset, offset + limit);
  return { rows: page, total: filtered.length, subjects: subjectsOf(filtered) };
}

function subjectsOf(rows: BrowseRow[]): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const m = r.code.match(/^[A-Z]+/);
    if (m) set.add(m[0]);
  }
  return [...set].sort();
}
