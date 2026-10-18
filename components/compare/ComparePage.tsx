"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { formatCode, sessionName } from "@/engine/levels";
import type { Analysis } from "@/engine/types";
import { usePlanner } from "@/components/PlannerProvider";
import { postAnalysis } from "@/lib/analyze-client";
import { cn } from "@/lib/utils";

export function ComparePage() {
  const { scenarios, setScenarios, setBooks, setScenarioId, scenarioId, books, pinBooks, profile } = usePlanner();
  const [compareA, setCompareA] = useState(scenarioId);
  const [compareB, setCompareB] = useState(scenarios.find((s) => s.id !== scenarioId)?.id ?? scenarioId);

  const query = useQuery({
    queryKey: ["compare", compareA, compareB, books, pinBooks],
    queryFn: async () => {
      const [a, b] = await Promise.all([
        postAnalysis({ placements: books[compareA] ?? {}, pins: pinBooks[compareA], suggest: false }),
        postAnalysis({ placements: books[compareB] ?? {}, pins: pinBooks[compareB], suggest: false }),
      ]);
      return { a, b };
    },
    enabled: compareA !== compareB,
  });

  async function duplicate() {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromId: compareA }),
    });
    const copy = await res.json();
    setScenarios((prev) => [...prev, copy]);
    setBooks((prev) => ({ ...prev, [copy.id]: copy.placements }));
    setCompareB(copy.id);
  }

  const nameOf = (id: string) => scenarios.find((s) => s.id === id)?.name ?? id;
  const upcoming = profile.terms.filter((t) => t.kind === "study" && t.status !== "past");

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <div className="flex items-center gap-3">
        <h1 className="text-[24px] font-semibold tracking-tight">Compare plans</h1>
        <PlanSelect value={compareA} onChange={setCompareA} />
        <span className="text-[12px] text-ink-3">with</span>
        <PlanSelect value={compareB} onChange={setCompareB} />
      </div>

      {scenarios.length < 2 ? (
        <div className="surface mt-6 rounded-2xl px-5 py-5 text-[13px]">
          <p>You have one plan. Make a copy, change it in the workspace, then compare the two here.</p>
          <button
            type="button"
            className="mt-3 h-8 rounded-full bg-brand px-4 text-[12px] font-medium text-white transition hover:brightness-110"
            onClick={duplicate}
          >
            Duplicate {nameOf(compareA)}
          </button>
        </div>
      ) : compareA === compareB ? (
        <p className="mt-6 text-[13px] text-ink-2">Pick two different plans.</p>
      ) : !query.data ? (
        <p className="mt-6 text-[13px] text-ink-2">Checking both plans…</p>
      ) : (
        <>
          <SummaryTable a={query.data.a} b={query.data.b} nameA={nameOf(compareA)} nameB={nameOf(compareB)} />

          <div className="surface mt-5 rounded-2xl px-5 py-4">
          <h2 className="pb-2 text-[15px] font-semibold tracking-tight">Courses by term</h2>
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] text-ink-3">
                <th className="w-[120px] py-1 font-medium">Term</th>
                <th className="py-1 font-medium">{nameOf(compareA)}</th>
                <th className="py-1 font-medium">{nameOf(compareB)}</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.map((t) => {
                const left = books[compareA]?.[t.id] ?? [];
                const right = books[compareB]?.[t.id] ?? [];
                return (
                  <tr key={t.id} className="border-t border-[#eef1f6] align-top">
                    <td className="py-1.5">
                      <span className="font-semibold">{t.label}</span>{" "}
                      <span className="text-ink-3">{sessionName(t.id)}</span>
                    </td>
                    <td className="py-1.5 pr-3">
                      <Codes codes={left} other={right} />
                    </td>
                    <td className="py-1.5">
                      <Codes codes={right} other={left} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-ink-3">Highlighted courses are in one plan but not the other that term.</p>
          </div>
          <div className="mt-4 flex gap-3 text-[12px]">
            <Link href="/" className="text-brand hover:underline" onClick={() => setScenarioId(compareA)}>
              Open {nameOf(compareA)} in workspace
            </Link>
            <Link href="/" className="text-brand hover:underline" onClick={() => setScenarioId(compareB)}>
              Open {nameOf(compareB)} in workspace
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function PlanSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { scenarios } = usePlanner();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="select-pill h-8 rounded-full border border-line px-3 text-[13px]"
    >
      {scenarios.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}

function Codes({ codes, other }: { codes: string[]; other: string[] }) {
  if (codes.length === 0) return <span className="text-ink-3">Nothing planned</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {codes.map((c) => (
        <span
          key={c}
          className={cn(
            "rounded-md px-1.5 py-0.5",
            other.includes(c) ? "bg-[#f1f3f8] text-[#2a3142]" : "bg-brand-soft font-medium text-brand",
          )}
        >
          {formatCode(c)}
        </span>
      ))}
    </span>
  );
}

function SummaryTable({ a, b, nameA, nameB }: { a: Analysis; b: Analysis; nameA: string; nameB: string }) {
  const open = (x: Analysis) => x.credentials.reduce((n, c) => n + c.groups.filter((g) => !g.satisfied).length, 0);
  const errors = (x: Analysis) => x.problems.filter((p) => p.severity === "error").length;
  const rows = a.credentials.flatMap((cred) =>
    cred.groups
      .map((g) => {
        const other = b.credentials.find((c) => c.id === cred.id)?.groups.find((x) => x.id === g.id);
        return { key: `${cred.id}:${g.id}`, label: `${cred.short} · ${g.label}`, a: g.satisfied, b: other?.satisfied ?? false };
      })
      .filter((r) => r.a !== r.b),
  );

  return (
    <>
      <div className="surface mt-5 rounded-2xl px-5 py-4">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-line text-left text-[11px] text-ink-3">
            <th className="py-1 font-medium" />
            <th className="w-[30%] py-1 font-medium">{nameA}</th>
            <th className="w-[30%] py-1 font-medium">{nameB}</th>
          </tr>
        </thead>
        <tbody>
          <SummaryRow label="Units with this plan" a={a.units.projected} b={b.units.projected} higherIsBetter />
          <SummaryRow label="Requirements still open" a={open(a)} b={open(b)} />
          <SummaryRow label="Blocking problems" a={errors(a)} b={errors(b)} />
        </tbody>
      </table>
      </div>
      <div className="surface mt-5 rounded-2xl px-5 py-4">
      <h2 className="pb-2 text-[15px] font-semibold tracking-tight">Requirements that differ</h2>
      {rows.length === 0 ? (
        <p className="py-2 text-[12px] text-ink-2">Both plans meet the same requirements.</p>
      ) : (
        <table className="w-full border-collapse text-[12px]">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-[#eef1f6]">
                <td className="py-1.5">{r.label}</td>
                <td className={cn("w-[30%] py-1.5", r.a ? "text-[#16a34a]" : "text-[#d1372c]")}>{r.a ? "Met" : "Open"}</td>
                <td className={cn("w-[30%] py-1.5", r.b ? "text-[#16a34a]" : "text-[#d1372c]")}>{r.b ? "Met" : "Open"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div>
    </>
  );
}

function SummaryRow({ label, a, b, higherIsBetter }: { label: string; a: number; b: number; higherIsBetter?: boolean }) {
  const better = (x: number, y: number) => (higherIsBetter ? x > y : x < y);
  return (
    <tr className="border-t border-[#eef1f6]">
      <td className="py-1.5 text-[#2a3142]">{label}</td>
      <td className={cn("py-1.5 tabular-nums", better(a, b) && "font-semibold text-[#16a34a]")}>{a}</td>
      <td className={cn("py-1.5 tabular-nums", better(b, a) && "font-semibold text-[#16a34a]")}>{b}</td>
    </tr>
  );
}
