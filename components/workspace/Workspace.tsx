"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { formatCode } from "@/engine/levels";
import { usePlanner } from "@/components/PlannerProvider";
import { programAccent, spring } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { CoursePickerSheet } from "./CoursePickerSheet";
import { Inspector } from "./Inspector";
import { TermStage } from "./TermStage";
import { TermStrip } from "./TermStrip";

export function Workspace() {
  const { analysis, addCourse, moveCourse, removeCourse, setDragCode, dragCode } = usePlanner();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onDragStart(e: DragStartEvent) {
    setDragCode(String(e.active.data.current?.code ?? "") || null);
  }

  function onDragEnd(e: DragEndEvent) {
    const code = String(e.active.data.current?.code ?? "");
    const source = e.active.data.current?.source as string | undefined;
    const fromTermId = e.active.data.current?.termId as string | undefined;
    const overId = e.over?.id?.toString() ?? "";
    setDragCode(null);
    if (!code) return;
    const toTerm =
      overId.startsWith("term:") || overId.startsWith("stage:") ? overId.split(":")[1] : null;
    if (overId === "trash" && fromTermId) removeCourse(code, fromTermId);
    else if (toTerm && source === "list") addCourse(code, toTerm);
    else if (toTerm && fromTermId) moveCourse(code, fromTermId, toTerm);
  }

  const accent = dragCode
    ? programAccent(analysis.credentials, analysis.countsFor[dragCode]?.[0]?.credentialId ?? "")
    : null;

  return (
    <DndContext
      id="planner-dnd"
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragCode(null)}
    >
      <div className="flex h-full min-h-0 min-w-[1180px] flex-col gap-3 p-3">
        <TermStrip />
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_340px] gap-3">
          <TermStage />
          <Inspector />
        </div>
      </div>
      <TrashTarget active={!!dragCode} />
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.22,1,0.36,1)" }}>
        {dragCode ? (
          <div
            className="flex w-[180px] rotate-[-2deg] cursor-grabbing flex-col rounded-xl border border-white bg-white py-2 pl-3.5 pr-3 shadow-[0_18px_40px_-12px_rgba(27,33,48,0.35)]"
            style={{ borderLeft: `4px solid ${accent?.solid ?? "#d5dae4"}` }}
          >
            <span className="text-[13px] font-semibold">{formatCode(dragCode)}</span>
            <span className="truncate text-[11px] text-ink-2">{analysis.titles?.[dragCode] ?? "Drop on a term"}</span>
          </div>
        ) : null}
      </DragOverlay>
      <CoursePickerSheet />
    </DndContext>
  );
}

function TrashTarget({ active }: { active: boolean }) {
  const drop = useDroppable({ id: "trash" });
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          ref={drop.setNodeRef}
          initial={{ opacity: 0, y: 30, x: "-50%" }}
          animate={{ opacity: 1, y: 0, x: "-50%", scale: drop.isOver ? 1.08 : 1 }}
          exit={{ opacity: 0, y: 30, x: "-50%" }}
          transition={spring}
          className={cn(
            "fixed bottom-14 left-1/2 z-30 flex items-center gap-2 rounded-full border px-5 py-3 text-[13px] font-medium shadow-lift",
            drop.isOver ? "border-[#e5484d] bg-[#e5484d] text-white" : "border-[#f3c6c3] bg-white/95 text-[#d1372c]",
          )}
        >
          <Trash2 className="h-4 w-4" />
          {drop.isOver ? "Release to remove" : "Drop here to remove"}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
