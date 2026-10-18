"use client";

import { usePlanner } from "@/components/PlannerProvider";
import { CountUp } from "@/components/ui/CountUp";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const { asOfAnalysis, asOfDisplayTermId, profile, openRequirementCount, analysisFetching } = usePlanner();
  const asOfLabel = profile.terms.find((t) => t.id === asOfDisplayTermId)?.label;
  const errors = asOfAnalysis.problems.filter((p) => p.severity === "error").length;
  const { projected, target } = asOfAnalysis.units;
  const pct = target ? Math.min(1, projected / target) : 0;

  return (
    <footer className="flex h-9 shrink-0 items-center gap-5 px-6 text-[12px] text-ink-2">
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-[#e3e8f0]">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-[#2f6bff] to-[#7c4dff] transition-[width] duration-700"
            style={{ width: `${pct * 100}%` }}
          />
        </span>
        <span>
          <CountUp
            key={`units:${asOfDisplayTermId}`}
            value={projected}
            decimals={projected % 1 ? 2 : 0}
            className="font-semibold text-[#1b2130] tabular-nums"
          />
          {target != null ? ` of ${target}` : ""} units
          {asOfLabel ? ` · ${asOfLabel}` : ""}
        </span>
      </span>
      <span>
        <CountUp
          key={`open:${asOfDisplayTermId}`}
          value={openRequirementCount}
          className="font-semibold text-[#1b2130] tabular-nums"
        />{" "}
        requirements open
      </span>
      <span className={cn("flex items-center gap-1.5", errors > 0 && "text-[#d1372c]")}>
        <span className={cn("h-1.5 w-1.5 rounded-full", errors > 0 ? "bg-[#e5484d]" : "bg-[#22c55e]")} />
        {errors > 0 ? `${errors} problem${errors === 1 ? "" : "s"}` : "No blocking issues"}
      </span>
      <span className="ml-auto text-ink-3">
        {analysisFetching ? "Updating…" : "←/→ switch terms · A add a course · ⌘Z undo"}
      </span>
    </footer>
  );
}
