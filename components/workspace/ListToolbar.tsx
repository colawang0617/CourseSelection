"use client";

import { Search } from "lucide-react";
import { useMemo } from "react";
import type { BrowseFilters } from "@/engine/types";
import { usePlanner } from "@/components/PlannerProvider";
import { cn } from "@/lib/utils";
import { ROW_COLS } from "./CourseRow";

const FALLBACK_SUBJECTS = ["AMATH", "CO", "CS", "ECE", "ENGL", "MATH", "PHYS", "SE", "STAT", "SYDE"];

export function ListToolbar({
  subjects: poolSubjects = [],
  searchPlaceholder = "Filter by code or title",
}: {
  subjects?: string[];
  searchPlaceholder?: string;
}) {
  const { listQuery, setListQuery, listFilters, setListFilters, listSearchFocusRef } = usePlanner();

  const subjects = useMemo(() => {
    const set = new Set([...FALLBACK_SUBJECTS, ...poolSubjects]);
    return ["", ...[...set].sort()];
  }, [poolSubjects]);

  const toggle = (key: "offeredOnly" | "prereqsMet" | "hideTakenPlanned") =>
    setListFilters((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="shrink-0 border-b border-line bg-white/60">
      <div className="flex flex-wrap items-center gap-2 px-4 pb-2 pt-3">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <input
            ref={listSearchFocusRef}
            value={listQuery}
            onChange={(e) => setListQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-full border border-line bg-white pl-8 pr-3 text-[13px] outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
          />
        </div>
        <select
          value={listFilters.subject ?? ""}
          onChange={(e) => setListFilters((f) => ({ ...f, subject: e.target.value || undefined }))}
          className="select-pill h-9 rounded-full border border-line px-3 text-[12px] text-ink-2"
        >
          {subjects.map((s) => (
            <option key={s || "all"} value={s}>
              {s || "Any subject"}
            </option>
          ))}
        </select>
        <select
          value={listFilters.levelMin ?? ""}
          onChange={(e) =>
            setListFilters((f) => ({ ...f, levelMin: e.target.value ? Number(e.target.value) : undefined }))
          }
          className="select-pill h-9 rounded-full border border-line px-3 text-[12px] text-ink-2"
        >
          <option value="">Level min</option>
          {[100, 200, 300, 400].map((l) => (
            <option key={l} value={l}>
              {l}+
            </option>
          ))}
        </select>
        <select
          value={listFilters.levelMax ?? ""}
          onChange={(e) =>
            setListFilters((f) => ({ ...f, levelMax: e.target.value ? Number(e.target.value) : undefined }))
          }
          className="select-pill h-9 rounded-full border border-line px-3 text-[12px] text-ink-2"
        >
          <option value="">Level max</option>
          {[199, 299, 399, 499].map((l) => (
            <option key={l} value={l}>
              ≤{l}
            </option>
          ))}
        </select>
        <select
          value={listFilters.sort ?? "fit"}
          onChange={(e) => setListFilters((f) => ({ ...f, sort: e.target.value as BrowseFilters["sort"] }))}
          className="select-pill h-9 rounded-full border border-line px-3 text-[12px] text-ink-2"
        >
          <option value="fit">Sort: best fit</option>
          <option value="code">Sort: code</option>
          <option value="liked">Sort: liked</option>
        </select>
      </div>
      <div className="flex items-center gap-1.5 px-4 pb-2.5">
        <FilterChip active={listFilters.offeredOnly} onClick={() => toggle("offeredOnly")}>
          Offered that term
        </FilterChip>
        <FilterChip active={listFilters.prereqsMet} onClick={() => toggle("prereqsMet")}>
          Prerequisites met
        </FilterChip>
        <FilterChip active={listFilters.hideTakenPlanned} onClick={() => toggle("hideTakenPlanned")}>
          Hide taken and planned
        </FilterChip>
      </div>
    </div>
  );
}

export function ColumnHeader({ sticky = true }: { sticky?: boolean }) {
  return (
    <div
      className={cn(
        "z-10 grid gap-2 border-b border-line bg-[#f8f9fc] px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-3",
        sticky && "sticky top-0",
        ROW_COLS,
      )}
    >
      <span />
      <span>Code</span>
      <span>Title</span>
      <span>That term</span>
      <span className="text-right">Liked</span>
      <span>Status</span>
    </div>
  );
}

function FilterChip({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-7 rounded-full border px-3 text-[12px] transition",
        active ? "border-brand bg-brand text-white" : "border-line bg-white text-ink-2 hover:border-[#c9d4ec]",
      )}
    >
      {children}
    </button>
  );
}
