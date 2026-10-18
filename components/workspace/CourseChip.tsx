"use client";

import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { formatCode } from "@/engine/levels";
import type { Analysis } from "@/engine/types";
import { usePlanner } from "@/components/PlannerProvider";
import { coversLine } from "@/lib/covers";
import { programAccent, spring } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Drop only the redundant named-core label ("Programming", "Operating systems").
 * Keep required-elective labels (User interfaces, Mechanics) and any extra sections.
 */
export function chipLabels(code: string, analysis: Analysis) {
  const uses = analysis.countsFor[code] ?? [];
  const required = analysis.required?.find((r) => r.code === code);
  if (!required || required.kind === "choice") return uses;
  return uses.filter(
    (u) =>
      !(
        u.credentialId === required.credentialId &&
        (u.groupId === code.toLowerCase() || u.label === required.label)
      ),
  );
}

function useChipInfo(code: string, termId: string, analysis: Analysis) {
  const uses = analysis.countsFor[code] ?? [];
  const labels = chipLabels(code, analysis);
  const required = analysis.required?.find((r) => r.code === code);
  const problem = analysis.problems.find((p) => p.code === code && p.termId === termId && p.severity === "error");
  const accents = [...new Set(uses.map((u) => u.credentialId))].map((id) => programAccent(analysis.credentials, id));
  const offTerm = required?.kind === "sequence" && required.termId && required.termId !== termId ? required.level : null;
  return { uses: labels, required, problem, accents, offTerm, title: analysis.titles?.[code] ?? "" };
}

/** Large card on the term stage. */
export function CourseChip({ code, termId, analysis }: { code: string; termId: string; analysis: Analysis }) {
  const { selection, setSelection, removeCourse } = usePlanner();
  const { uses, required, problem, accents, offTerm, title } = useChipInfo(code, termId, analysis);
  const selected = selection?.kind === "course" && selection.code === code;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `chip:${termId}:${code}`,
    data: { source: "chip", code, termId },
  });

  return (
    <motion.div
      layout
      layoutId={`stage-${code}`}
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: isDragging ? 0.35 : 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={spring}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        setSelection({ kind: "course", code, termId });
      }}
      title={[title, coversLine(analysis, code) && `Counts toward ${coversLine(analysis, code)}`, problem?.message]
        .filter(Boolean)
        .join("\n")}
      className={cn(
        "group relative flex min-h-[76px] cursor-grab flex-col overflow-hidden rounded-xl border bg-white py-2 pl-3.5 pr-2.5 shadow-soft transition-shadow hover:shadow-lift active:cursor-grabbing",
        selected ? "border-brand ring-2 ring-brand/25" : "border-line",
        problem && !selected && "border-[#f3b4ae] bg-[#fff8f7]",
      )}
    >
      <span className="absolute inset-y-0 left-0 flex w-[4px] flex-col">
        {(accents.length ? accents : [{ solid: "#d5dae4" }]).map((a, i) => (
          <span key={i} className="flex-1" style={{ background: a.solid }} />
        ))}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] font-semibold tracking-tight">{formatCode(code)}</span>
        {required && (
          <span className="rounded-full bg-[#1b2130] px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-white">
            Required
          </span>
        )}
        {problem && <AlertTriangle className="h-3.5 w-3.5 text-[#d1372c]" />}
        <button
          type="button"
          aria-label={`Remove ${formatCode(code)}`}
          className="ml-auto rounded p-0.5 text-ink-3 opacity-0 transition hover:bg-[#f1f3f8] hover:text-[#d1372c] group-hover:opacity-100"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            removeCourse(code, termId);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <span className="truncate text-[12px] text-ink-2">{title !== code ? title : ""}</span>
      <div className="mt-auto flex flex-wrap items-center gap-1 pt-1">
        {problem ? (
          <span className="truncate text-[11px] text-[#d1372c]">{problem.message}</span>
        ) : uses.length ? (
          uses.map((u) => {
            const a = programAccent(analysis.credentials, u.credentialId);
            return (
              <span
                key={`${u.credentialId}:${u.groupId}`}
                className="max-w-full truncate rounded-full px-1.5 py-[1px] text-[10px] font-medium"
                style={{ background: a.soft, color: a.text }}
              >
                {u.label}
              </span>
            );
          })
        ) : required ? null : (
          <span className="text-[11px] text-ink-3">Not counted yet</span>
        )}
        {offTerm && <span className="text-[10px] text-ink-3">Calendar: {offTerm}</span>}
      </div>
    </motion.div>
  );
}

/** Small pill inside a timeline card. */
export function MiniChip({
  code,
  termId,
  analysis,
  grade,
  past,
}: {
  code: string;
  termId: string;
  analysis: Analysis;
  grade?: number | null;
  past?: boolean;
}) {
  const { setSelection } = usePlanner();
  const { accents, required, problem } = useChipInfo(code, termId, analysis);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `mini:${termId}:${code}`,
    data: { source: "chip", code, termId },
    disabled: past,
  });
  const accent = accents[0];
  return (
    <motion.span
      layout
      layoutId={`mini-${code}`}
      transition={spring}
      ref={setNodeRef}
      {...(past ? {} : listeners)}
      {...(past ? {} : attributes)}
      onClick={(e) => {
        e.stopPropagation();
        setSelection({ kind: "course", code, termId });
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-[2px] text-[10.5px] font-medium leading-tight",
        past ? "bg-[#f1f3f8] text-ink-2" : "cursor-grab bg-white text-[#1b2130] shadow-[0_0_0_1px_var(--line)]",
        problem && "text-[#d1372c] shadow-[0_0_0_1px_#f3b4ae]",
        isDragging && "opacity-30",
      )}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: accent?.solid ?? (required ? "#1b2130" : "#cfd5e0") }}
      />
      {formatCode(code)}
      {grade != null && <span className="text-ink-3">{grade}</span>}
    </motion.span>
  );
}
