"use client";

import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import { Check, GripVertical, Plus } from "lucide-react";
import { formatCode } from "@/engine/levels";
import type { BrowseRow } from "@/engine/types";
import { usePlanner } from "@/components/PlannerProvider";
import { cn } from "@/lib/utils";
import { fillsLine } from "@/lib/covers";

export const ROW_COLS = "grid-cols-[16px_84px_minmax(0,1fr)_minmax(0,150px)_44px_96px]";

export function CourseRow({ row }: { row: BrowseRow }) {
  const { selection, setSelection, addCourse, targetTermId } = usePlanner();
  const selected = selection?.kind === "course" && selection.code === row.code;
  const covers = fillsLine(row.fills);
  const canDrag = row.status.kind === "available";
  const inactive = !canDrag;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `list:${row.code}`,
    data: { source: "list", code: row.code, offeringByTerm: row.offeringByTerm },
    disabled: !canDrag,
  });
  const hasFills = row.fills.length > 0 && row.status.kind === "available";

  return (
    <div
      ref={setNodeRef}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
      className={cn(
        "grid items-center gap-2 border-b border-[#eef1f6] px-4 text-[12.5px] transition-colors",
        ROW_COLS,
        hasFills ? "min-h-[44px] py-1" : "h-[36px]",
        canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        selected ? "bg-brand-soft" : "hover:bg-[#f6f8fd]",
        isDragging && "opacity-40",
      )}
      onClick={() => setSelection({ kind: "course", code: row.code, fills: row.fills })}
      title={covers ? `Would help: ${covers}` : undefined}
    >
      <GripVertical className={cn("h-3.5 w-3.5", canDrag ? "text-ink-3" : "text-transparent")} />
      <span className={cn("whitespace-nowrap font-semibold", inactive && "text-ink-3")}>{formatCode(row.code)}</span>
      <div className="min-w-0">
        <span className={cn("block truncate", inactive ? "text-ink-3" : "text-[#2a3142]")}>{row.title}</span>
        {hasFills && (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {row.fills.slice(0, 2).map((f) => (
              <span
                key={`${f.short}-${f.label}`}
                className="truncate rounded-full bg-[#eef2ff] px-1.5 py-[0.5px] text-[10px] font-medium text-[#3b4cca]"
              >
                {f.short ? `${f.short} · ${f.label}` : f.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <AvailabilityCell row={row} />
      <span className="text-right tabular-nums text-ink-2">
        {row.liked != null ? `${Math.round(row.liked * 100)}%` : "–"}
      </span>
      <StatusCell row={row} targetTermId={targetTermId} onAdd={() => addCourse(row.code, targetTermId)} />
    </div>
  );
}

function AvailabilityCell({ row }: { row: BrowseRow }) {
  if (row.status.kind !== "available") return <span />;
  const offer =
    row.offering === "offered" ? "Offered that term" : row.offering === "absent" ? "Not offered that term" : "Schedule not posted";
  const tip = `${offer}\n${row.blocked ? `Prerequisites: ${row.blocked}` : "Prerequisites met"}`;
  if (row.blocked) {
    return (
      <span className="truncate text-[#b45309]" title={tip}>
        {row.blocked}
      </span>
    );
  }
  if (row.offering === "absent") {
    return (
      <span className="truncate text-[#d1372c]" title={tip}>
        Not offered
      </span>
    );
  }
  return (
    <span className={cn("flex items-center gap-1", row.offering === "offered" ? "text-[#16a34a]" : "text-ink-3")} title={tip}>
      <Check className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{row.offering === "offered" ? "Can take" : "No schedule yet"}</span>
    </span>
  );
}

function StatusCell({ row, targetTermId, onAdd }: { row: BrowseRow; targetTermId: string; onAdd: () => void }) {
  if (row.status.kind === "taken") {
    return (
      <span className="truncate text-ink-3">
        Took {row.status.termLabel}
        {row.status.grade != null ? ` · ${row.status.grade}` : ""}
      </span>
    );
  }
  if (row.status.kind === "planned") {
    const here = row.status.termId === targetTermId;
    return (
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "inline-flex w-fit items-center gap-1 truncate rounded-full px-2 py-0.5 text-[11px] font-medium",
          here ? "bg-[#e3f7ea] text-[#15803d]" : "bg-brand-soft text-brand",
        )}
      >
        {here && <Check className="h-3 w-3" />}
        In {row.status.termLabel}
      </motion.span>
    );
  }
  return (
    <button
      type="button"
      className="inline-flex h-6 w-fit items-center gap-0.5 rounded-full border border-[#cfd8ea] bg-white px-2.5 text-[11.5px] font-medium text-brand transition hover:border-brand hover:bg-brand hover:text-white active:scale-95"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
      }}
    >
      <Plus className="h-3 w-3" /> Add
    </button>
  );
}
