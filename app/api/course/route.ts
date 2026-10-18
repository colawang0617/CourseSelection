import { NextResponse } from "next/server";
import { requisiteCourses } from "@/engine/prereq";
import { readable, sessionLabel } from "@/engine/levels";
import { loadCatalogs, loadOfferings, loadRatings } from "@/lib/store";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.toUpperCase() ?? "";
  const catalogs = loadCatalogs();
  const newest = catalogs[catalogs.length - 1]?.courses ?? {};
  const course = newest[code] ?? catalogs[0]?.courses[code];
  if (!course) return NextResponse.json({ error: "missing" }, { status: 404 });
  const offerings = loadOfferings();
  const rating = loadRatings()[code] ?? null;
  const prereqs = requisiteCourses(course.prerequisites);
  const unlocks: string[] = [];
  for (const other of Object.values(newest)) {
    if (unlocks.length >= 8) break;
    if (requisiteCourses(other.prerequisites).includes(code)) unlocks.push(other.code);
  }
  const terms = offerings.postedTerms.map((term) => ({
    id: term,
    label: sessionLabel(term),
    status:
      offerings.courses[code]?.[term] === true
        ? "offered"
        : offerings.courses[code]?.[term] === false
          ? "absent"
          : "unknown",
  }));
  return NextResponse.json({
    ...course,
    prereqText: readable(course.prereqText),
    coreqText: readable(course.coreqText),
    antireqText: readable(course.antireqText),
    prereqs,
    unlocks,
    terms,
    rating,
  });
}
