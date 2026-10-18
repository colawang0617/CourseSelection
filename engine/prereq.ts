import { HTMLElement, parse } from "node-html-parser";
import type { Antirequisite, Requisite } from "./types";
import { formatCode, levelAtLeast } from "./levels";

const CODE = /\b([A-Z]{2,10}\d{1,4}[A-Z]{0,3})\b/g;

export interface CheckCtx {
  /** Completed (or planned earlier) course -> grade, if any. Includes cross-list aliases. */
  before: Map<string, { grade?: number }>;
  sameTerm: Set<string>;
  level: string;
  plan: string;
  average: number;
}

export interface CheckResult {
  ok: boolean;
  reasons: string[];
  warnings: string[];
}

function ownText(li: HTMLElement): string {
  const copy = parse(`<div>${li.innerHTML}</div>`);
  copy.querySelectorAll("ul").forEach((u) => u.remove());
  return copy.text.replace(/\s+/g, " ").trim();
}

function childLis(li: HTMLElement): HTMLElement[] {
  const all = li.querySelectorAll("li");
  return all.filter((child) => {
    let p: HTMLElement | null = child.parentNode as HTMLElement | null;
    while (p && p !== li) {
      if (p.tagName === "LI") return false;
      p = p.parentNode as HTMLElement | null;
    }
    return p === li;
  });
}

function localCodes(li: HTMLElement): string[] {
  const text = ownText(li);
  const found = new Set<string>();
  for (const match of text.matchAll(CODE)) found.add(match[1]);
  return [...found];
}

function planNames(li: HTMLElement): string[] {
  const names: string[] = [];
  for (const a of li.querySelectorAll("a")) {
    const insideChild = childLis(li).some((c) => c.innerHTML.includes(a.outerHTML));
    if (insideChild) continue;
    const text = a.text.replace(/\s+/g, " ").trim();
    if (!text || /^[A-Z]{2,10}\d/.test(text)) continue;
    names.push(text);
  }
  return names;
}

function courseReq(
  code: string,
  when: "prior" | "prior-or-same",
  minGrade?: number,
): Requisite {
  return minGrade == null
    ? { op: "course", code, when }
    : { op: "course", code, when, minGrade };
}

export function parseRequisite(
  html: string | null | undefined,
  when: "prior" | "prior-or-same" = "prior",
): Requisite | null {
  if (!html || !html.trim()) return null;
  const root = parse(html);
  const top = root.querySelector("li");
  if (!top) {
    const text = root.text.replace(/\s+/g, " ").trim();
    return text ? { op: "unparsed", text } : null;
  }
  return simplify(parseLi(top, when));
}

function parseLi(li: HTMLElement, when: "prior" | "prior-or-same"): Requisite {
  const text = ownText(li);
  const kids = childLis(li).map((c) => parseLi(c, when));
  const codes = localCodes(li).map((code) => courseReq(code, when));

  const level = text.match(/level\s+(\d[AB])\s+or higher/i);
  if (level && kids.length === 0 && codes.length === 0) {
    return { op: "level", min: level[1].toUpperCase() };
  }

  const average = text.match(/cumulative average of\s+(\d+(?:\.\d+)?)/i);
  if (average && codes.length === 0 && kids.length === 0) {
    return { op: "average", min: Number(average[1]) };
  }

  if (/enrolled in/i.test(text) && kids.length === 0) {
    const plans = planNames(li);
    if (plans.length) return { op: "plan", plans };
  }

  const gradeEach = text.match(/minimum grade of\s+(\d+(?:\.\d+)?)%?\s+in each/i);
  const gradeSome = text.match(
    /minimum grade of\s+(\d+(?:\.\d+)?)%?\s+in at least\s+(\d+)/i,
  );
  if (gradeEach) {
    const items = localCodes(li).map((code) =>
      courseReq(code, when, Number(gradeEach[1])),
    );
    return { op: "and", items: [...items, ...kids] };
  }
  if (gradeSome) {
    const items = localCodes(li).map((code) =>
      courseReq(code, when, Number(gradeSome[1])),
    );
    return { op: "or", n: Number(gradeSome[2]), items: [...items, ...kids] };
  }

  const atLeast = text.match(/at least\s+(\d+)\s+of the following/i);
  const completeN = text.match(/complete\s+(\d+)\s+of the following/i);
  const chooseAny = /choose any of the following/i.test(text);
  const completeAll = /complete all(?: of the following)?/i.test(text);
  const mustAll = /must have completed the following/i.test(text);

  if (completeAll || mustAll) return { op: "and", items: [...codes, ...kids] };
  if (atLeast || completeN) {
    return {
      op: "or",
      n: Number((atLeast ?? completeN)![1]),
      items: [...codes, ...kids],
    };
  }
  if (chooseAny) return { op: "or", n: 1, items: [...codes, ...kids] };

  if (codes.length === 0 && kids.length === 0) {
    return text ? { op: "unparsed", text } : { op: "true" };
  }
  if (kids.length === 0 && codes.length === 1) return codes[0];
  if (kids.length === 0) return { op: "and", items: codes };
  if (codes.length === 0 && kids.length === 1) return kids[0];
  return { op: "and", items: [...codes, ...kids] };
}

function simplify(req: Requisite): Requisite {
  if (req.op === "and") {
    const items = req.items.map(simplify).filter((i) => i.op !== "true");
    if (items.length === 0) return { op: "true" };
    if (items.length === 1) return items[0];
    return { op: "and", items };
  }
  if (req.op === "or") {
    const items = req.items.map(simplify).filter((i) => i.op !== "true");
    if (items.length === 0) return { op: "true" };
    return { op: "or", n: req.n, items };
  }
  return req;
}

export function parseAntirequisite(html: string | null | undefined): Antirequisite | null {
  if (!html || !html.trim()) return null;
  const root = parse(html);
  const top = root.querySelector("li");
  if (!top) {
    const text = root.text.replace(/\s+/g, " ").trim();
    return text ? { op: "unparsed", text } : null;
  }
  return simplifyAnti(parseAntiLi(top));
}

function parseAntiLi(li: HTMLElement): Antirequisite {
  const text = ownText(li);
  const kids = childLis(li);
  const concurrent = /concurrent/i.test(text);
  if (/not completed/i.test(text)) {
    const nested = kids.filter((c) => /not completed|complete all/i.test(ownText(c)));
    const codes = [...new Set([...li.text.matchAll(CODE)].map((m) => m[1]))];
    const self: Antirequisite = { op: "notWith", codes, concurrent };
    return nested.length ? { op: "and", items: [self, ...nested.map(parseAntiLi)] } : self;
  }
  const parsedKids = kids.map(parseAntiLi);
  const codes = localCodes(li);
  if (/complete all/i.test(text) && parsedKids.length) return { op: "and", items: parsedKids };
  if (parsedKids.length === 1 && codes.length === 0) return parsedKids[0];
  if (parsedKids.length > 1) return { op: "and", items: parsedKids };
  if (codes.length) return { op: "notWith", codes, concurrent };
  return text ? { op: "unparsed", text } : { op: "true" };
}

function simplifyAnti(req: Antirequisite): Antirequisite {
  if (req.op !== "and") return req;
  const items = req.items.map(simplifyAnti).filter((i) => i.op !== "true");
  if (items.length === 0) return { op: "true" };
  if (items.length === 1) return items[0];
  return { op: "and", items };
}

function held(
  ctx: CheckCtx,
  code: string,
  when: "prior" | "prior-or-same",
): { grade?: number } | undefined {
  const prior = ctx.before.get(code);
  if (prior) return prior;
  if (when === "prior-or-same" && ctx.sameTerm.has(code)) return {};
  return undefined;
}

export function checkRequisite(req: Requisite | null, ctx: CheckCtx): CheckResult {
  if (!req || req.op === "true") return { ok: true, reasons: [], warnings: [] };
  if (req.op === "unparsed") {
    return { ok: true, reasons: [], warnings: [req.text] };
  }
  if (req.op === "level") {
    const ok = levelAtLeast(ctx.level, req.min);
    return ok
      ? { ok: true, reasons: [], warnings: [] }
      : { ok: false, reasons: [`Needs level ${req.min}`], warnings: [] };
  }
  if (req.op === "plan") {
    const ok = req.plans.some((p) => p === ctx.plan);
    return ok
      ? { ok: true, reasons: [], warnings: [] }
      : { ok: false, reasons: ["Not open to your plan"], warnings: [] };
  }
  if (req.op === "average") {
    const ok = ctx.average >= req.min;
    return ok
      ? { ok: true, reasons: [], warnings: [] }
      : { ok: false, reasons: [`Needs a ${req.min}% average`], warnings: [] };
  }
  if (req.op === "course") {
    const got = held(ctx, req.code, req.when);
    if (!got) return { ok: false, reasons: [`Needs ${formatCode(req.code)}`], warnings: [] };
    if (req.minGrade != null && got.grade != null && got.grade < req.minGrade) {
      return {
        ok: false,
        reasons: [`Needs ${req.minGrade}% in ${formatCode(req.code)}`],
        warnings: [],
      };
    }
    return { ok: true, reasons: [], warnings: [] };
  }
  if (req.op === "and") {
    const parts = req.items.map((item) => checkRequisite(item, ctx));
    const reasons = parts.flatMap((p) => (p.ok ? [] : p.reasons)).slice(0, 3);
    const warnings = parts.flatMap((p) => p.warnings);
    return { ok: parts.every((p) => p.ok), reasons, warnings };
  }
  const parts = req.items.map((item) => checkRequisite(item, ctx));
  const passed = parts.filter((p) => p.ok).length;
  const warnings = parts.flatMap((p) => p.warnings);
  if (passed >= req.n) return { ok: true, reasons: [], warnings };
  const reasons = parts.flatMap((p) => (p.ok ? [] : p.reasons)).slice(0, 3);
  return {
    ok: false,
    reasons: reasons.length ? reasons : [`Needs ${req.n} more`],
    warnings,
  };
}

export function checkAntirequisite(
  req: Antirequisite | null,
  ctx: CheckCtx,
): CheckResult {
  if (!req || req.op === "true") return { ok: true, reasons: [], warnings: [] };
  if (req.op === "unparsed") return { ok: true, reasons: [], warnings: [req.text] };
  if (req.op === "and") {
    const parts = req.items.map((item) => checkAntirequisite(item, ctx));
    return {
      ok: parts.every((p) => p.ok),
      reasons: parts.flatMap((p) => p.reasons).slice(0, 3),
      warnings: parts.flatMap((p) => p.warnings),
    };
  }
  const hit = req.codes.filter((code) => {
    if (ctx.before.has(code)) return true;
    return req.concurrent && ctx.sameTerm.has(code);
  });
  if (hit.length === 0) return { ok: true, reasons: [], warnings: [] };
  return {
    ok: false,
    reasons: hit.slice(0, 2).map((code) => `Conflicts with ${formatCode(code)}`),
    warnings: [],
  };
}

/** Courses mentioned in a requisite tree, for the detail graph. */
export function requisiteCourses(req: Requisite | null): string[] {
  if (!req) return [];
  if (req.op === "course") return [req.code];
  if (req.op === "and" || req.op === "or") {
    return [...new Set(req.items.flatMap(requisiteCourses))];
  }
  return [];
}
