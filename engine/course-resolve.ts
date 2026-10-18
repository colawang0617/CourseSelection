import type { AnalyzeInput } from "./analyze";
import type { CourseRecord } from "./types";

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

export function resolveCourseForInput(
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

export function newestCatalog(input: AnalyzeInput): Record<string, Partial<CourseRecord>> | undefined {
  const catalogs = [...(input.catalogs ?? [])].sort((a, b) => b.since.localeCompare(a.since));
  return catalogs[0]?.courses ?? input.courses;
}
