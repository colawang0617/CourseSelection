"use client";

import { useDroppable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { Briefcase } from "lucide-react";
import { Fragment } from "react";
import { sessionName } from "@/engine/levels";
import type { Analysis, Profile, TermDef } from "@/engine/types";
import { usePlanner } from "@/components/PlannerProvider";
import { spring } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { MiniChip } from "./CourseChip";

export function termCodes(profile: Profile, placements: Record<string, string[]>, termId: string) {
  const taken = profile.transcript.filter((c) => c.term === termId && c.credits > 0);
  const planned = (placements[termId] ?? []).filter((code) => !taken.some((c) => c.code === code));
  return { taken, codes: [...taken.map((c) => c.code), ...planned] };
}

export function TermStrip() {
  const { profile, analysis } = usePlanner();
  const terms = profile.terms;
  const study = terms.filter((t) => t.kind === "study");

  return (
    <div className="glass flex shrink-0 items-stretch gap-1.5 overflow-x-auto rounded-2xl p-1.5">
      {study.map((term, i) => {
        const prev = study[i - 1];
        const between = prev
          ? terms.slice(terms.indexOf(prev) + 1, terms.indexOf(term)).filter((t) => t.kind === "work")
          : [];
        return (
          <Fragment key={term.id}>
            {between.length > 0 && (
              <div
                className="flex w-5 shrink-0 flex-col items-center justify-center gap-1 text-ink-3"
                title={`Co-op: ${between.map((t) => t.label).join(", ")}`}
              >
                <Briefcase className="h-3 w-3" />
                <span className="h-6 w-px bg-line" />
              </div>
            )}
            <TermCard term={term} profile={profile} analysis={analysis} />
          </Fragment>
        );
      })}
    </div>
  );
}

function TermCard({ term, profile, analysis }: { term: TermDef; profile: Profile; analysis: Analysis }) {
  const { placements, focusTermId, setFocusTermId } = usePlanner();
  const past = term.status === "past";
  const drop = useDroppable({ id: `term:${term.id}`, disabled: past });
  const { taken, codes } = termCodes(profile, placements, term.id);
  const max = term.maxCourses ?? 0;
  const focused = term.id === focusTermId;
  const errors = analysis.problems.filter((p) => p.termId === term.id && p.severity === "error").length;
  const pct = max ? Math.min(1, codes.length / max) : 0;
  const overload = max > 0 && codes.length > max;

  return (
    <motion.div
      ref={drop.setNodeRef}
      role="button"
      tabIndex={0}
      onClick={() => setFocusTermId(term.id)}
      onKeyDown={(e) => e.key === "Enter" && setFocusTermId(term.id)}
      animate={{ y: drop.isOver ? -3 : 0, scale: drop.isOver ? 1.02 : 1 }}
      transition={spring}
      className={cn(
        "relative flex min-w-[132px] flex-1 cursor-pointer flex-col gap-1.5 rounded-xl px-2.5 py-2 outline-none transition-colors",
        past ? "bg-transparent hover:bg-white/60" : "bg-white/70 hover:bg-white",
        focused && "bg-white shadow-lift",
        drop.isOver && "bg-white ring-2 ring-brand",
      )}
    >
      {focused && (
        <motion.span
          layoutId="term-focus"
          transition={spring}
          className="absolute inset-x-3 -bottom-[3px] h-[3px] rounded-full bg-brand"
        />
      )}
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-[15px] font-semibold tracking-tight", past && "text-ink-2")}>{term.label}</span>
        <span className="truncate text-[11px] text-ink-3">{sessionName(term.id)}</span>
        {term.status === "current" && (
          <span className="ml-auto rounded-full bg-brand-soft px-1.5 text-[9.5px] font-semibold text-brand">Now</span>
        )}
        {errors > 0 && (
          <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-[#e5484d]" title={`${errors} problems`} />
        )}
      </div>
      {!past && (
        <div className="flex items-center gap-1.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#e9edf4]">
            <motion.div
              className={cn("h-full rounded-full", overload ? "bg-[#f59e0b]" : "bg-brand")}
              animate={{ width: `${pct * 100}%` }}
              transition={spring}
            />
          </div>
          <span className={cn("text-[10.5px] tabular-nums", overload ? "font-semibold text-[#a15c00]" : "text-ink-3")}>
            {codes.length}
            {max ? `/${max}` : ""}
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {codes.map((code) => (
          <MiniChip
            key={code}
            code={code}
            termId={term.id}
            analysis={analysis}
            past={past}
            grade={past ? taken.find((c) => c.code === code)?.grade : undefined}
          />
        ))}
      </div>
    </motion.div>
  );
}
