"use client";

import { useDroppable } from "@dnd-kit/core";
import { useQueries } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ChevronLeft, ChevronRight, Info, Plus, Sparkles, ThumbsUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatCode, sessionName } from "@/engine/levels";
import type { Analysis, BrowseRow, Profile, RequiredCourse, TermDef } from "@/engine/types";
import { usePlanner } from "@/components/PlannerProvider";
import { postBrowseGroup } from "@/lib/browse-client";
import { programAccent, spring } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { chipLabels, CourseChip } from "./CourseChip";
import { termCodes } from "./TermStrip";

export function TermStage() {
  const { profile, analysis, focusTermId, setFocusTermId } = usePlanner();
  const study = profile.terms.filter((t) => t.kind === "study");
  const index = Math.max(0, study.findIndex((t) => t.id === focusTermId));
  const term = study[index];
  const prevIndex = useRef(index);
  const [direction, setDirection] = useState(1);
  useEffect(() => {
    if (prevIndex.current !== index) {
      setDirection(index > prevIndex.current ? 1 : -1);
      prevIndex.current = index;
    }
  }, [index]);
  if (!term) return null;

  return (
    <section className="surface relative flex min-h-0 flex-col overflow-hidden rounded-2xl">
      <AnimatePresence mode="popLayout" initial={false} custom={direction}>
        <motion.div
          key={term.id}
          custom={direction}
          variants={{
            enter: (d: number) => ({ opacity: 0, x: d * 36 }),
            center: { opacity: 1, x: 0 },
            exit: (d: number) => ({ opacity: 0, x: d * -36 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="flex min-h-0 flex-1 flex-col"
        >
          <StageHeader
            term={term}
            profile={profile}
            prev={study[index - 1]}
            next={study[index + 1]}
            onFocus={setFocusTermId}
          />
          <StageBody term={term}>
            {term.status === "past" ? (
              <PastBody term={term} profile={profile} analysis={analysis} />
            ) : (
              <UpcomingBody term={term} profile={profile} analysis={analysis} />
            )}
          </StageBody>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

function StageBody({ term, children }: { term: TermDef; children: React.ReactNode }) {
  const { dragCode } = usePlanner();
  const drop = useDroppable({ id: `stage:${term.id}:body`, disabled: term.status === "past" });
  return (
    <div
      ref={drop.setNodeRef}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto px-6 pb-6 transition-colors",
        dragCode && drop.isOver && "bg-brand-soft/40",
      )}
    >
      {children}
    </div>
  );
}

function StageHeader({
  term,
  profile,
  prev,
  next,
  onFocus,
}: {
  term: TermDef;
  profile: Profile;
  prev?: TermDef;
  next?: TermDef;
  onFocus: (id: string) => void;
}) {
  const { placements, openPicker } = usePlanner();
  const { codes } = termCodes(profile, placements, term.id);
  const max = term.maxCourses ?? 0;
  const past = term.status === "past";
  const status = past ? "Completed" : term.status === "current" ? "This term" : "Upcoming";

  return (
    <header className="flex shrink-0 items-center gap-4 px-6 pb-4 pt-5">
      <div className="flex items-center gap-1">
        <NavButton label={prev ? `Previous: ${prev.label}` : undefined} onClick={() => prev && onFocus(prev.id)}>
          <ChevronLeft className="h-4 w-4" />
        </NavButton>
        <NavButton label={next ? `Next: ${next.label}` : undefined} onClick={() => next && onFocus(next.id)}>
          <ChevronRight className="h-4 w-4" />
        </NavButton>
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2.5">
          <h1 className="text-[28px] font-semibold leading-none tracking-tight">{term.label}</h1>
          <span className="text-[15px] text-ink-2">{sessionName(term.id)}</span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              past ? "bg-[#eef1f6] text-ink-2" : "bg-brand-soft text-brand",
            )}
          >
            {status}
          </span>
        </div>
        {!past && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex gap-1">
              {Array.from({ length: Math.max(max, codes.length) }, (_, i) => (
                <motion.span
                  key={i}
                  layout
                  className={cn(
                    "h-1.5 w-6 rounded-full",
                    i < codes.length ? (i >= max ? "bg-[#f59e0b]" : "bg-brand") : "bg-[#e3e8f0]",
                  )}
                />
              ))}
            </div>
            <span className={cn("text-[12px]", codes.length > max ? "font-medium text-[#a15c00]" : "text-ink-2")}>
              {codes.length} of {max} courses{codes.length > max ? " · overload" : ""}
            </span>
          </div>
        )}
      </div>
      {!past && (
        <button
          type="button"
          onClick={() => openPicker({ termId: term.id })}
          className="ml-auto inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-[13px] font-medium text-white shadow-[0_6px_16px_-6px_rgba(47,107,255,0.7)] transition hover:brightness-110 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" /> Add course
          <kbd className="rounded bg-white/20 px-1 text-[10px] font-semibold">A</kbd>
        </button>
      )}
    </header>
  );
}

function NavButton({ label, onClick, children }: { label?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={!label}
      onClick={onClick}
      className="rounded-full border border-line bg-white p-1.5 text-ink-2 transition hover:text-[#1b2130] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-baseline gap-2 first:mt-0">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-2">{children}</h2>
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </div>
  );
}

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(188px,1fr))] gap-2.5";

function UpcomingBody({ term, profile, analysis }: { term: TermDef; profile: Profile; analysis: Analysis }) {
  const { placements } = usePlanner();
  const { codes } = termCodes(profile, placements, term.id);
  const required = analysis.required ?? [];
  const requiredCodes = new Set(required.map((r) => r.code));
  const sequenceHere = required.filter((r) => r.kind === "sequence" && r.termId === term.id);
  const requiredHere = codes.filter((c) => requiredCodes.has(c));
  const picks = codes.filter((c) => !requiredCodes.has(c));
  const takenCodes = new Set(profile.transcript.map((t) => t.code));
  const ghosts = sequenceHere.filter((r) => !codes.includes(r.code) && !takenCodes.has(r.code));
  const max = term.maxCourses ?? 0;
  const open = Math.max(0, max - codes.length);
  const problems = analysis.problems.filter((p) => p.termId === term.id);

  return (
    <>
      {(requiredHere.length > 0 || ghosts.length > 0) && (
        <>
          <SectionTitle hint="From your program calendar. You can still move these.">Required</SectionTitle>
          <div className={GRID}>
            <AnimatePresence mode="popLayout">
              {requiredHere.map((code) => (
                <CourseChip key={code} code={code} termId={term.id} analysis={analysis} />
              ))}
              {ghosts.map((r) => (
                <GhostCard key={`ghost-${r.code}`} req={r} term={term} analysis={analysis} />
              ))}
            </AnimatePresence>
          </div>
        </>
      )}
      <SectionTitle hint={picks.length === 0 ? "Nothing chosen yet" : undefined}>Your picks</SectionTitle>
      <div className={GRID}>
        <AnimatePresence mode="popLayout">
          {picks.map((code) => (
            <CourseChip key={code} code={code} termId={term.id} analysis={analysis} />
          ))}
        </AnimatePresence>
        {Array.from({ length: Math.min(open, 3) }, (_, i) => (
          <AddCard key={`add-${i}`} term={term} first={i === 0} />
        ))}
        {open === 0 && <AddCard term={term} first overload />}
      </div>
      {open > 3 && <p className="mt-2 text-[12px] text-ink-3">{open} open slots</p>}
      <GoodFits term={term} analysis={analysis} />
      {problems.length > 0 && (
        <>
          <SectionTitle>Heads up</SectionTitle>
          <ul className="space-y-1.5">
            {problems.map((p, i) => (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px]",
                  p.severity === "error" ? "bg-[#fff1f0] text-[#9f1f17]" : "bg-[#fff7e6] text-[#7a4a00]",
                )}
              >
                {p.severity === "error" ? (
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                )}
                <span>
                  {p.code && <b className="font-semibold">{formatCode(p.code)} </b>}
                  {p.message}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function GhostCard({ req, term, analysis }: { req: RequiredCourse; term: TermDef; analysis: Analysis }) {
  const { addCourse, moveCourse, profile } = usePlanner();
  const elsewhere = analysis.termOf?.[req.code];
  const elsewhereLabel = elsewhere ? profile.terms.find((t) => t.id === elsewhere)?.label : null;
  const accent = programAccent(analysis.credentials, req.credentialId);
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={spring}
      className="flex min-h-[76px] flex-col rounded-xl border border-dashed border-[#c9d1de] bg-white/40 px-3 py-2"
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[13px] font-semibold text-ink-2">{formatCode(req.code)}</span>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent.solid }} />
      </div>
      <span className="truncate text-[12px] text-ink-3">{analysis.titles?.[req.code] ?? req.label}</span>
      <div className="mt-auto flex items-center justify-between pt-1 text-[11px]">
        <span className="text-ink-3">{elsewhereLabel ? `Planned in ${elsewhereLabel}` : "Not planned yet"}</span>
        <button
          type="button"
          className="font-medium text-brand hover:underline"
          onClick={() => (elsewhere ? moveCourse(req.code, elsewhere, term.id) : addCourse(req.code, term.id))}
        >
          {elsewhere ? "Move here" : "Add"}
        </button>
      </div>
    </motion.div>
  );
}

function AddCard({ term, first, overload }: { term: TermDef; first?: boolean; overload?: boolean }) {
  const { openPicker } = usePlanner();
  const drop = useDroppable({ id: `stage:${term.id}:${overload ? "over" : "slot"}`, data: { termId: term.id } });
  return (
    <motion.button
      layout
      ref={drop.setNodeRef}
      type="button"
      onClick={() => openPicker({ termId: term.id })}
      whileHover={{ y: -2 }}
      transition={spring}
      className={cn(
        "flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-[12.5px] font-medium transition-colors",
        drop.isOver
          ? "border-brand bg-brand-soft text-brand"
          : overload
            ? "border-[#f5d28a] text-[#a15c00] hover:bg-[#fff8e8]"
            : first
              ? "border-[#b9c8f5] text-brand hover:bg-brand-soft/60"
              : "border-[#dfe4ee] text-ink-3 hover:border-[#b9c8f5] hover:text-brand",
      )}
    >
      <Plus className="h-4 w-4" />
      {drop.isOver ? "Drop to add" : overload ? "Add an overload course" : "Add course"}
    </motion.button>
  );
}

function GoodFits({ term, analysis }: { term: TermDef; analysis: Analysis }) {
  const { placements, pins, addCourse, setSelection, openPicker } = usePlanner();
  const groups = analysis.credentials
    .flatMap((c) => c.groups.filter((g) => !g.satisfied).map((g) => ({ cred: c, group: g })))
    .slice(0, 4);
  const filters = { hideTakenPlanned: true, sort: "fit" as const };
  const results = useQueries({
    queries: groups.map(({ group }) => ({
      queryKey: ["browse-group", group.id, placements, pins, term.id, filters],
      queryFn: () => postBrowseGroup({ placements, pins, targetTermId: term.id, groupId: group.id, filters }),
      staleTime: 20_000,
    })),
  });
  if (groups.length === 0) return null;

  const seen = new Set<string>();
  const fits: { row: BrowseRow; credId: string; groupId: string }[] = [];
  results.forEach((r, i) => {
    const row = r.data?.rows.find(
      (x) => !x.blocked && x.offeringByTerm[term.id] !== "absent" && x.status.kind === "available" && !seen.has(x.code),
    );
    if (row) {
      seen.add(row.code);
      fits.push({ row, credId: groups[i].cred.id, groupId: groups[i].group.id });
    }
  });
  const loading = results.some((r) => r.isLoading);

  return (
    <>
      <SectionTitle hint="Ready to take, and they fill open requirements">
        <span className="inline-flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-[#7c4dff]" /> Good fits
        </span>
      </SectionTitle>
      {loading && fits.length === 0 ? (
        <div className={GRID}>
          {groups.map((g) => (
            <div key={g.group.id} className="h-[92px] animate-pulse rounded-xl bg-[#eef1f6]" />
          ))}
        </div>
      ) : fits.length === 0 ? (
        <p className="text-[12.5px] text-ink-3">No ready suggestions for this term.</p>
      ) : (
        <div className={GRID}>
          {fits.map(({ row, credId, groupId }) => {
            const accent = programAccent(analysis.credentials, credId);
            return (
              <motion.div
                key={row.code}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={spring}
                onClick={() => setSelection({ kind: "course", code: row.code })}
                className="group flex cursor-pointer flex-col rounded-xl border border-line bg-gradient-to-br from-white to-[#f8f9fd] px-3 py-2.5 transition hover:shadow-soft"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold">{formatCode(row.code)}</span>
                  {row.liked != null && (
                    <span className="inline-flex items-center gap-0.5 text-[11px] text-ink-3">
                      <ThumbsUp className="h-3 w-3" />
                      {Math.round(row.liked * 100)}%
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      addCourse(row.code, term.id);
                    }}
                    className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand transition hover:bg-brand hover:text-white"
                  >
                    <Plus className="h-3 w-3" /> Add
                  </button>
                </div>
                <span className="truncate text-[12px] text-ink-2">{row.title}</span>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {row.fills.slice(0, 2).map((f) => (
                    <span
                      key={f.label}
                      className="truncate rounded-full px-1.5 py-[1px] text-[10px] font-medium"
                      style={{ background: accent.soft, color: accent.text }}
                    >
                      {f.label}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPicker({ termId: term.id, list: groupId });
                  }}
                  className="mt-1.5 self-start text-[11px] text-ink-3 hover:text-brand"
                >
                  More like this
                </button>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );
}

function PastBody({ term, profile, analysis }: { term: TermDef; profile: Profile; analysis: Analysis }) {
  const taken = profile.transcript.filter((c) => c.term === term.id && c.credits > 0);
  const graded = taken.filter((c) => typeof c.grade === "number");
  const avg = graded.length ? graded.reduce((s, c) => s + (c.grade as number), 0) / graded.length : null;
  return (
    <>
      <SectionTitle hint={avg != null ? `Term average ${avg.toFixed(1)}` : undefined}>Courses taken</SectionTitle>
      <div className={GRID}>
        {taken.map((c) => (
          <PastCard key={c.code} code={c.code} termId={term.id} grade={c.grade} analysis={analysis} />
        ))}
      </div>
      {taken.length === 0 && <p className="text-[12.5px] text-ink-3">No courses recorded for this term.</p>}
    </>
  );
}

function PastCard({
  code,
  termId,
  grade,
  analysis,
}: {
  code: string;
  termId: string;
  grade?: number | null;
  analysis: Analysis;
}) {
  const { setSelection } = usePlanner();
  const required = analysis.required?.some((r) => r.code === code);
  const uses = chipLabels(code, analysis);
  return (
    <button
      type="button"
      onClick={() => setSelection({ kind: "course", code, termId })}
      className="flex min-h-[76px] flex-col rounded-xl border border-line bg-white px-3 py-2 text-left shadow-soft transition hover:shadow-lift"
    >
      <div className="flex w-full items-center">
        <span className="text-[13px] font-semibold">{formatCode(code)}</span>
        {required && (
          <span className="ml-1.5 rounded-full bg-[#1b2130] px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-white">
            Required
          </span>
        )}
        {grade != null && <span className="ml-auto text-[15px] font-semibold tabular-nums">{grade}</span>}
      </div>
      <span className="mt-1 w-full truncate text-[12px] text-ink-2">{analysis.titles?.[code] ?? ""}</span>
      {uses.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {uses.map((u) => {
            const a = programAccent(analysis.credentials, u.credentialId);
            return (
              <span
                key={`${u.credentialId}:${u.groupId}`}
                className="truncate rounded-full px-1.5 py-[1px] text-[10px] font-medium"
                style={{ background: a.soft, color: a.text }}
              >
                {u.label}
              </span>
            );
          })}
        </div>
      )}
    </button>
  );
}
