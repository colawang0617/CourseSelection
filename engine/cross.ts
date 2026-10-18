import type { CourseRecord } from "./types";

export function crossAliases(courses: CourseRecord[]): Map<string, Set<string>> {
  const parent = new Map<string, string>();
  const find = (code: string): string => {
    if (!parent.has(code)) parent.set(code, code);
    const p = parent.get(code)!;
    if (p !== code) {
      const root = find(p);
      parent.set(code, root);
      return root;
    }
    return p;
  };
  const union = (a: string, b: string) => {
    const pa = find(a);
    const pb = find(b);
    if (pa !== pb) parent.set(pa, pb);
  };
  for (const course of courses) {
    find(course.code);
    for (const other of course.crossList) union(course.code, other);
  }
  const groups = new Map<string, Set<string>>();
  for (const code of parent.keys()) {
    const root = find(code);
    const set = groups.get(root) ?? new Set<string>();
    set.add(code);
    groups.set(root, set);
  }
  const out = new Map<string, Set<string>>();
  for (const set of groups.values()) for (const code of set) out.set(code, set);
  return out;
}

export function expandCodes(codes: Iterable<string>, cross: Map<string, Set<string>>): Set<string> {
  const out = new Set<string>();
  for (const code of codes) {
    out.add(code);
    for (const a of cross.get(code) ?? []) out.add(a);
  }
  return out;
}
