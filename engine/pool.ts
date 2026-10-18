import type { AnalyzeInput } from "./analyze";
import { newestCatalog } from "./course-resolve";
import type { CatalogList, CredentialDef } from "./types";

export function codesForGroup(
  group: CredentialDef["groups"][number],
  lists: Record<string, CatalogList>,
): Set<string> {
  const pool = new Set<string>();
  for (const code of group.codes ?? []) pool.add(code);
  for (const ref of [...(group.listRef ? [group.listRef] : []), ...(group.listRefs ?? [])]) {
    for (const code of lists[ref]?.codes ?? []) pool.add(code);
  }
  return pool;
}

export function extendPoolForGroup(
  input: AnalyzeInput,
  group: CredentialDef["groups"][number] | undefined,
  lists: Record<string, CatalogList>,
  pool: Set<string>,
) {
  const searchIn = newestCatalog(input);
  if (!group || !searchIn) return;
  const subjects = new Set<string>(group.subjects ?? []);
  for (const ref of [...(group.listRef ? [group.listRef] : []), ...(group.listRefs ?? [])]) {
    for (const s of lists[ref]?.subjects ?? []) subjects.add(s);
  }
  if (subjects.size) {
    let added = 0;
    for (const [code, course] of Object.entries(searchIn)) {
      if (added > 200) break;
      const subject = course.subject ?? code.match(/^[A-Z]+/)?.[0] ?? "";
      if (!subjects.has(subject)) continue;
      pool.add(code);
      added++;
    }
  }
}

export function poolFromQuery(input: AnalyzeInput, query: string, pool: Set<string>, cap = 80) {
  const searchIn = newestCatalog(input);
  if (!searchIn || !query.trim()) return;
  const q = query.toLowerCase().replace(/\s+/g, "");
  let added = 0;
  for (const [code, course] of Object.entries(searchIn)) {
    if (added >= cap) break;
    const title = (course.title ?? "").toLowerCase();
    if (code.toLowerCase().includes(q) || title.replace(/\s+/g, "").includes(q)) {
      pool.add(code);
      added++;
    }
  }
}

export function poolFromCatalog(input: AnalyzeInput, offset: number, limit: number): string[] {
  const searchIn = newestCatalog(input);
  if (!searchIn) return [];
  const codes = Object.keys(searchIn).sort();
  return codes.slice(offset, offset + limit);
}

export function courseLevel(code: string): number {
  const m = code.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}
