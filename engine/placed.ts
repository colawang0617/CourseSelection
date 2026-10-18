import { LISTS } from "@/data/lists";
import { allocate, type SolverCourse } from "./allocate";
import type { AnalyzeInput } from "./analyze";
import { crossAliases } from "./cross";
import { resolveCourseForInput } from "./course-resolve";
import type { CourseRecord } from "./types";

export interface PlacedCourse {
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

export function buildPlaced(input: AnalyzeInput): PlacedCourse[] {
  const terms = input.profile.terms;
  const termById = new Map(terms.map((t, index) => [t.id, { ...t, index }]));
  const placed: PlacedCourse[] = [];
  const seen = new Set<string>();

  const add = (
    code: string,
    termId: string,
    status: PlacedCourse["status"],
    grade: number | null | undefined,
    credits?: number,
  ) => {
    if (seen.has(code)) return;
    seen.add(code);
    const term = termById.get(termId);
    if (!term) return;
    const record = resolveCourseForInput(input, code, termId, credits);
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
  return placed;
}

export function averageOfPlaced(placed: PlacedCourse[]) {
  let points = 0;
  let credits = 0;
  for (const course of placed) {
    if (course.status !== "complete" || course.grade == null || course.credits <= 0) continue;
    points += course.grade * course.credits;
    credits += course.credits;
  }
  return credits ? points / credits : 0;
}

export async function buildAssignment(input: AnalyzeInput, placed: PlacedCourse[]) {
  const lists = input.lists ?? LISTS;
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
  return { assignment, cross, lists };
}
