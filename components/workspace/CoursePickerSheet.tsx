"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MousePointerClick, X } from "lucide-react";
import { sessionName } from "@/engine/levels";
import { usePlanner } from "@/components/PlannerProvider";
import { spring } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { CourseInspector } from "./Inspector";
import { ListPane } from "./ListPane";
import { termCodes } from "./TermStrip";

export function CoursePickerSheet() {
  const { pickerOpen, closePicker } = usePlanner();
  return (
    <AnimatePresence>
      {pickerOpen && (
        <motion.div
          key="picker"
          className="fixed inset-0 z-40 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-[#1b2130]/25 backdrop-blur-[6px]" onClick={closePicker} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Add courses"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={spring}
            className="relative flex h-[84vh] w-[min(1320px,88vw)] flex-col overflow-hidden rounded-[22px] border border-white/70 bg-[#fbfcff]/95 shadow-[0_40px_120px_-30px_rgba(27,33,48,0.45)]"
          >
            <SheetHeader />
            <div className="flex min-h-0 flex-1">
              <div className="min-w-0 flex-1">
                <ListPane />
              </div>
              <SheetDetail />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SheetHeader() {
  const { profile, placements, targetTermId, setTargetTermId, closePicker } = usePlanner();
  const upcoming = profile.terms.filter((t) => t.kind === "study" && t.status !== "past");
  const term = upcoming.find((t) => t.id === targetTermId);
  const { codes } = termCodes(profile, placements, targetTermId);
  const max = term?.maxCourses ?? 0;

  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-line bg-white/70 px-5 py-3">
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Adding to</div>
        <div className="flex items-baseline gap-2">
          <span className="text-[18px] font-semibold tracking-tight">
            {term?.label} · {sessionName(targetTermId)}
          </span>
          <span className={cn("text-[13px]", codes.length > max ? "font-medium text-[#a15c00]" : "text-ink-2")}>
            {codes.length} of {max}
            {codes.length > max ? " · overload" : ""}
          </span>
        </div>
      </div>
      <div className="ml-4 flex items-center gap-1 rounded-full bg-[#eef1f7] p-1">
        {upcoming.map((t) => {
          const n = termCodes(profile, placements, t.id).codes.length;
          const active = t.id === targetTermId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTargetTermId(t.id)}
              className={cn(
                "relative rounded-full px-3 py-1 text-[12px] font-medium transition-colors",
                active ? "text-[#1b2130]" : "text-ink-2 hover:text-[#1b2130]",
              )}
            >
              {active && (
                <motion.span
                  layoutId="picker-term"
                  transition={spring}
                  className="absolute inset-0 rounded-full bg-white shadow-soft"
                />
              )}
              <span className="relative">
                {t.label}
                <span className="ml-1 text-ink-3">{n}</span>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={closePicker}
        className="ml-auto inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] text-ink-2 transition hover:text-[#1b2130]"
      >
        Done
        <kbd className="rounded bg-[#eef1f7] px-1 text-[10px]">Esc</kbd>
        <X className="h-3.5 w-3.5" />
      </button>
    </header>
  );
}

function SheetDetail() {
  const { selection } = usePlanner();
  return (
    <aside className="w-[340px] shrink-0 overflow-y-auto border-l border-line bg-white/80">
      <AnimatePresence mode="wait" initial={false}>
        {selection?.kind === "course" ? (
          <motion.div
            key={selection.code}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.16 }}
          >
            <CourseInspector code={selection.code} />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-[12.5px] text-ink-3"
          >
            <MousePointerClick className="h-6 w-6 text-[#c3cbdb]" />
            Click a course to see prerequisites, ratings, and what it counts toward.
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}
