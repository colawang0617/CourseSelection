import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { parse } from "node-html-parser";
import { parseAntirequisite, parseRequisite } from "../engine/prereq";
import type { CourseRecord } from "../engine/types";

const BASE = "https://uwaterloocm.kuali.co/api/v1/catalog";
const CATALOGS = [
  { id: "657084224811c0001ce0fd94", file: "courses-2024-25.json" },
  { id: "67e557ed6ed2fe2bd3a38956", file: "courses-2026-27.json" },
] as const;

const OUT = new URL("../data/catalog/", import.meta.url);

function text(html: string | undefined): string {
  if (!html) return "";
  return parse(html).text.replace(/\s+/g, " ").trim();
}

function codesIn(html: string): string[] {
  return [...new Set([...html.matchAll(/>([A-Z]{2,10}\d{1,4}[A-Z]{0,3})</g)].map((m) => m[1]))];
}

async function getJson(url: string): Promise<unknown> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw new Error("unreachable");
}

async function pool<T>(items: T[], size: number, fn: (item: T, index: number) => Promise<void>) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await fn(items[index], index);
      }
    }),
  );
}

async function syncCourses(catalogId: string, file: string) {
  mkdirSync(OUT, { recursive: true });
  const dest = new URL(file, OUT);
  const partial = new URL(file.replace(".json", ".partial.json"), OUT);
  const have = new Map<string, CourseRecord>();
  if (existsSync(partial)) {
    const prev = JSON.parse(readFileSync(partial, "utf8")) as CourseRecord[];
    for (const course of prev) have.set(course.code, course);
  }
  const index = (await getJson(`${BASE}/courses/${catalogId}`)) as { pid: string; __catalogCourseId: string }[];
  console.log(`${file}: ${index.length} courses, ${have.size} already saved`);
  let done = 0;
  await pool(index, 24, async (item) => {
    if (have.has(item.__catalogCourseId)) {
      done++;
      return;
    }
    const raw = (await getJson(`${BASE}/course/${catalogId}/${item.pid}`)) as Record<string, unknown>;
    const credits = Number((raw.credits as { value?: string } | undefined)?.value ?? 0.5);
    const subject = (raw.subjectCode as { name?: string } | undefined)?.name ?? "";
    const cross = ((raw.crossListedCourses as { __catalogCourseId?: string }[] | undefined) ?? [])
      .map((c) => c.__catalogCourseId)
      .filter((c): c is string => Boolean(c));
    const record: CourseRecord = {
      code: String(raw.__catalogCourseId ?? item.__catalogCourseId),
      title: text(String(raw.title ?? "")),
      credits: Number.isFinite(credits) ? credits : 0.5,
      subject,
      description: text(typeof raw.description === "string" ? raw.description : "").slice(0, 600),
      crossList: cross,
      prerequisites: parseRequisite(typeof raw.prerequisites === "string" ? raw.prerequisites : null),
      corequisites: parseRequisite(
        typeof raw.corequisites === "string" ? raw.corequisites : null,
        "prior-or-same",
      ),
      antirequisites: parseAntirequisite(typeof raw.antirequisites === "string" ? raw.antirequisites : null),
      prereqText: text(typeof raw.prerequisites === "string" ? raw.prerequisites : "").slice(0, 400),
      coreqText: text(typeof raw.corequisites === "string" ? raw.corequisites : "").slice(0, 240),
      antireqText: text(typeof raw.antirequisites === "string" ? raw.antirequisites : "").slice(0, 240),
    };
    have.set(record.code, record);
    done++;
    if (done % 250 === 0) {
      writeFileSync(partial, JSON.stringify([...have.values()]));
      console.log(`  ${file} ${done}/${index.length}`);
    }
  });
  const courses = [...have.values()].sort((a, b) => a.code.localeCompare(b.code));
  writeFileSync(dest, JSON.stringify(courses));
  console.log(`wrote ${courses.length} -> ${file}`);
}

function headed(html: string): { title: string; body: string }[] {
  const parts = html.split(/<h2\b[^>]*>/i).slice(1);
  return parts.map((part) => {
    const title = (part.match(/^([\s\S]*?)<\/h2>/i)?.[1] ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    return { title, body: part };
  });
}

async function syncLists() {
  const se = (await getJson(`${BASE}/program/657084224811c0001ce0fd94/H1zle10Cs3`)) as {
    courseListsNew?: string;
  };
  const basc = (await getJson(`${BASE}/program/657084224811c0001ce0fd94/B1ligZqRn`)) as {
    courseListsNew?: string;
  };
  const lists: Record<string, { id: string; codes?: string[]; subjects?: string[]; exclude?: string[] }> = {};
  let bucket = "";
  for (const section of headed(se.courseListsNew ?? "")) {
    if (/communication/i.test(section.title)) bucket = "comm";
    else if (/natural science/i.test(section.title)) bucket = "ns";
    else if (/technical/i.test(section.title)) bucket = "te";
    else if (/additional/i.test(section.title)) bucket = "sustainability";
    let id = bucket;
    if (bucket === "ns" && section.title === "List 1") id = "ns-1";
    if (bucket === "ns" && section.title === "List 2") id = "ns-2";
    if (bucket === "te" && section.title === "List 1") id = "te-1";
    if (bucket === "te" && section.title === "List 2") id = "te-2";
    if (bucket === "te" && section.title === "List 3") id = "te-3";
    if (id === "ns" || id === "te") continue;
    const codes = codesIn(section.body);
    if (!codes.length) continue;
    lists[id] = { id, codes: [...new Set([...(lists[id]?.codes ?? []), ...codes])] };
  }
  for (const section of headed(basc.courseListsNew ?? "")) {
    if (section.title === "List A") lists["cse-a"] = { id: "cse-a", codes: codesIn(section.body) };
    if (section.title === "List C") {
      const plain = text(section.body);
      const subjectLine = plain.match(/subject codes[^:]*:\s*([^.]+)/i)?.[1] ?? "";
      const subjects = subjectLine.split(/[^A-Z]+/).filter((s) => /^[A-Z]{2,8}$/.test(s));
      const exclude: string[] = [];
      for (const block of section.body.split(/cannot be used/i).slice(1)) {
        exclude.push(...codesIn(block.split(/<h2/i)[0] ?? block));
      }
      lists["cse-c"] = { id: "cse-c", subjects, exclude: [...new Set(exclude)] };
    }
  }
  writeFileSync(new URL("lists.json", OUT), JSON.stringify(lists, null, 2));
  console.log("lists", Object.keys(lists).join(", "));
}

async function syncInvalid() {
  const policy = (await getJson(`${BASE}/policy/657084224811c0001ce0fd94/S17gweg46`)) as { body?: string };
  const root = parse(policy.body ?? "");
  const rows = root
    .querySelectorAll("tr")
    .map((tr) => tr.querySelectorAll("td").map((td) => td.text.replace(/\s+/g, " ").trim()))
    .filter((cells) => cells.length >= 3)
    .map((cells) => ({ plan: cells[0], cannot: cells[2] }));
  writeFileSync(new URL("invalid-combos.json", OUT), JSON.stringify(rows, null, 2));
  console.log(`invalid combinations: ${rows.length}`);
}

async function main() {
  await syncCourses(CATALOGS[0].id, CATALOGS[0].file);
  await syncCourses(CATALOGS[1].id, CATALOGS[1].file);
  await syncLists();
  await syncInvalid();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
