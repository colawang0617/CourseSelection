"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatCode, sessionName } from "@/engine/levels";
import type { BrowseFilters, BrowseRow, CredentialView, GroupView } from "@/engine/types";
import { usePlanner } from "@/components/PlannerProvider";
import { CountUp } from "@/components/ui/CountUp";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { postBrowseGroup } from "@/lib/browse-client";
import { programAccent, spring } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { CourseRow } from "./CourseRow";
import { ColumnHeader } from "./ListToolbar";

/** Shared swap timing — left slide + right reveal hold the same “resolve” length. */
const SWAP_S = 0.48;
/** Minimum resistance before committing the swap (Da Vinci–style hold while data loads). */
const HOLD_MS = 280;
const swapEase = [0.65, 0.05, 0.36, 1] as const;
const swapTransition = { type: "tween" as const, duration: SWAP_S, ease: swapEase };

export function RequirementSheet() {
  const { requirementFocus, closeRequirement } = usePlanner();
  return (
    <AnimatePresence>
      {requirementFocus && (
        <motion.div
          key="requirement"
          className="fixed inset-0 z-40 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <div className="absolute inset-0 bg-[#1b2130]/25 backdrop-blur-[6px]" onClick={closeRequirement} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Requirement details"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={spring}
            className="relative flex h-[84vh] w-[min(1180px,90vw)] overflow-hidden rounded-[22px] border border-white/70 bg-[#fbfcff]/95 shadow-[0_40px_120px_-30px_rgba(27,33,48,0.45)]"
          >
            <RequirementBody
              credentialId={requirementFocus.credentialId}
              groupId={requirementFocus.groupId}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function RequirementBody({ credentialId, groupId }: { credentialId: string; groupId: string }) {
  const {
    asOfAnalysis,
    profile,
    focusTermId,
    targetTermId,
    setTargetTermId,
    openRequirement,
    closeRequirement,
    placements,
    pins,
  } = usePlanner();
  const cred = asOfAnalysis.credentials.find((c) => c.id === credentialId);
  const asOfLabel = profile.terms.find((t) => t.id === focusTermId)?.label;
  const upcoming = profile.terms.filter((t) => t.kind === "study" && t.status !== "past");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<BrowseFilters>({
    hideTakenPlanned: true,
    sort: "fit",
  });

  /** What’s painted — lags behind `groupId` until load + hold resolve together. */
  const [shownGroupId, setShownGroupId] = useState(groupId);
  const [slideDir, setSlideDir] = useState(0);
  const prevTarget = useRef(groupId);
  const switching = groupId !== shownGroupId;

  useEffect(() => {
    if (!cred || prevTarget.current === groupId) return;
    const prev = cred.groups.findIndex((g) => g.id === prevTarget.current);
    const next = cred.groups.findIndex((g) => g.id === groupId);
    setSlideDir(next >= prev ? 1 : -1);
    prevTarget.current = groupId;
    setQuery("");
  }, [groupId, cred]);

  const browse = useQuery({
    queryKey: ["requirement-browse", groupId, placements, pins, targetTermId, filters],
    queryFn: () => postBrowseGroup({ placements, pins, targetTermId, groupId, filters }),
    enabled: !!cred?.groups.some((g) => g.id === groupId),
    staleTime: 15_000,
  });

  // Resistance hold overlaps the fetch: resolve at max(HOLD_MS, load), then left + right move together.
  const switchStarted = useRef<number | null>(null);
  useEffect(() => {
    if (groupId === shownGroupId) {
      switchStarted.current = null;
      return;
    }
    switchStarted.current ??= performance.now();
    if (browse.isFetching) return;
    if (!browse.isSuccess && !browse.isError) return;
    const elapsed = performance.now() - (switchStarted.current ?? performance.now());
    const wait = Math.max(0, HOLD_MS - elapsed);
    const t = window.setTimeout(() => {
      setShownGroupId(groupId);
      switchStarted.current = null;
    }, wait);
    return () => window.clearTimeout(t);
  }, [groupId, shownGroupId, browse.isFetching, browse.isSuccess, browse.isError, browse.dataUpdatedAt]);

  const shownGroup = cred?.groups.find((g) => g.id === shownGroupId);
  const targetGroup = cred?.groups.find((g) => g.id === groupId);
  const openGroups = cred?.groups.filter((g) => !g.satisfied) ?? [];
  const accent = programAccent(asOfAnalysis.credentials, credentialId);

  const rows = useMemo(() => {
    if (switching) return [];
    const all = browse.data?.rows ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) => r.code.toLowerCase().includes(q) || r.title.toLowerCase().includes(q),
    );
  }, [browse.data?.rows, query, switching]);

  if (!cred || !shownGroup || !targetGroup) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-[13px] text-ink-2">
        That requirement isn’t in your plan.
        <button type="button" className="ml-2 text-brand hover:underline" onClick={closeRequirement}>
          Close
        </button>
      </div>
    );
  }

  const filled = Math.min(shownGroup.courses.length, shownGroup.need);
  const remaining = Math.max(0, shownGroup.need - shownGroup.courses.length);

  return (
    <>
      <aside className="relative h-full w-[320px] shrink-0 overflow-hidden border-r border-line bg-white/80">
        <AnimatePresence mode="popLayout" custom={slideDir} initial={false}>
          <motion.div
            key={shownGroupId}
            custom={slideDir}
            variants={{
              enter: (dir: number) => ({ y: dir === 0 ? 0 : `${dir * 26}%`, opacity: 0 }),
              center: { y: 0, opacity: 1 },
              exit: (dir: number) => ({ y: dir === 0 ? 0 : `${dir * -18}%`, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={swapTransition}
            className="absolute inset-0 flex flex-col bg-white/80"
          >
            <RequirementSidebar
              cred={cred}
              group={shownGroup}
              filled={filled}
              remaining={remaining}
              accent={accent}
              asOfLabel={asOfLabel}
              openGroups={openGroups}
              busy={switching}
              onSelect={(id) => {
                if (switching || id === groupId) return;
                openRequirement({ credentialId, groupId: id });
              }}
            />
          </motion.div>
        </AnimatePresence>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b border-line bg-white/70 px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">Courses that count</div>
            <AnimatePresence mode="wait" initial={false} custom={slideDir}>
              <motion.div
                key={shownGroupId}
                custom={slideDir}
                initial={{ opacity: 0, y: slideDir >= 0 ? 10 : -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: slideDir >= 0 ? -8 : 8 }}
                transition={swapTransition}
                className="truncate text-[15px] font-semibold tracking-tight"
              >
                {switching ? targetGroup.label : (browse.data?.header ?? shownGroup.label)}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-[#eef1f7] p-1">
            {upcoming.map((t) => {
              const active = t.id === targetTermId;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTargetTermId(t.id)}
                  className={cn(
                    "relative rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
                    active ? "text-[#1b2130]" : "text-ink-2 hover:text-[#1b2130]",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="req-term"
                      transition={spring}
                      className="absolute inset-0 rounded-full bg-white shadow-soft"
                    />
                  )}
                  <span className="relative">{t.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={closeRequirement}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] text-ink-2 transition hover:text-[#1b2130]"
          >
            Done
            <kbd className="rounded bg-[#eef1f7] px-1 text-[10px]">Esc</kbd>
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="shrink-0 border-b border-line bg-white/50 px-4 py-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter this list"
              className="h-9 w-full rounded-full border border-line bg-white pl-8 pr-3 text-[13px] outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10"
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <FilterChip
              active={!!filters.hideTakenPlanned}
              onClick={() => setFilters((f) => ({ ...f, hideTakenPlanned: !f.hideTakenPlanned }))}
            >
              Hide taken & planned
            </FilterChip>
            <FilterChip
              active={!!filters.offeredOnly}
              onClick={() => setFilters((f) => ({ ...f, offeredOnly: !f.offeredOnly }))}
            >
              Offered that term
            </FilterChip>
            <FilterChip
              active={!!filters.prereqsMet}
              onClick={() => setFilters((f) => ({ ...f, prereqsMet: !f.prereqsMet }))}
            >
              Prerequisites met
            </FilterChip>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={slideDir}>
            <motion.div
              key={switching ? `hold-${groupId}` : shownGroupId}
              custom={slideDir}
              initial={{ opacity: 0, y: slideDir >= 0 ? 28 : -28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: slideDir >= 0 ? -20 : 20 }}
              transition={swapTransition}
              className="absolute inset-0 overflow-y-auto"
            >
              {switching || browse.isFetching ? (
                <ListHold />
              ) : (
                <>
                  <ColumnHeader />
                  {rows.length === 0 && (
                    <EmptyList
                      group={shownGroup}
                      anyHalf={(browse.data?.rows.length ?? 0) === 0 && !query}
                    />
                  )}
                  {rows.map((row: BrowseRow) => (
                    <CourseRow key={row.code} row={row} />
                  ))}
                  {browse.data?.truncated && (
                    <p className="px-4 py-3 text-[11px] text-ink-3">
                      List truncated — refine filters to narrow it.
                    </p>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

function ListHold() {
  return (
    <div className="flex h-full flex-col px-4 pt-3">
      <div className="mb-3 h-3 w-40 animate-pulse rounded-full bg-[#e8ecf4]" />
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="mb-2 h-9 animate-pulse rounded-lg bg-[#eef1f7]"
          style={{ opacity: 1 - i * 0.08, animationDelay: `${i * 40}ms` }}
        />
      ))}
    </div>
  );
}

function RequirementSidebar({
  cred,
  group,
  filled,
  remaining,
  accent,
  asOfLabel,
  openGroups,
  busy,
  onSelect,
}: {
  cred: CredentialView;
  group: GroupView;
  filled: number;
  remaining: number;
  accent: { solid: string };
  asOfLabel?: string;
  openGroups: GroupView[];
  busy?: boolean;
  onSelect: (groupId: string) => void;
}) {
  return (
    <>
      <div className="border-b border-line px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3">
          {cred.name}
          {asOfLabel ? ` · as of ${asOfLabel}` : ""}
        </p>
        <h2 className="mt-1 text-[20px] font-semibold tracking-tight">{group.label}</h2>
        <p className="mt-1 text-[12.5px] text-ink-2">
          {group.need === 1 ? "1 course required" : `${group.need} courses required`}
          {remaining > 0 ? ` · ${remaining} still open` : " · complete"}
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 px-5 py-6">
        <ProgressRing value={filled / Math.max(1, group.need)} color={accent.solid} size={96} stroke={8}>
          <span className="text-[18px] font-semibold tabular-nums">
            <CountUp value={filled} />
            <span className="text-ink-3">/{group.need}</span>
          </span>
        </ProgressRing>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-medium",
            group.satisfied ? "bg-[#e3f7ea] text-[#15803d]" : "bg-[#fff4dc] text-[#a15c00]",
          )}
        >
          {group.satisfied ? "Requirement met" : "In progress"}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">Your courses</h3>
        {group.courses.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-ink-3">Nothing counting here yet. Pick from the list →</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {group.courses.map((code) => (
              <FilledCourse key={code} code={code} />
            ))}
          </ul>
        )}
        {group.note && <p className="mt-3 text-[12px] leading-snug text-[#a15c00]">{group.note}</p>}

        {openGroups.length > 1 && (
          <>
            <h3 className="mb-1.5 mt-6 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">
              Other open in {cred.short}
            </h3>
            <ul className="space-y-0.5">
              {openGroups
                .filter((g) => g.id !== group.id)
                .map((g) => (
                  <li key={g.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onSelect(g.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-[#f4f6fb] disabled:opacity-50"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent.solid }} />
                      <span className="min-w-0 flex-1 truncate">{g.label}</span>
                      <span className="tabular-nums text-ink-3">
                        {Math.min(g.courses.length, g.need)}/{g.need}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}

function FilledCourse({ code }: { code: string }) {
  const { asOfAnalysis, profile, setSelection } = usePlanner();
  const title = asOfAnalysis.titles?.[code] ?? "";
  const transcript = profile.transcript.find((t) => t.code === code);
  const termId = transcript?.term ?? asOfAnalysis.termOf?.[code];
  const term = profile.terms.find((t) => t.id === termId);
  const status =
    transcript?.status === "complete"
      ? transcript.grade != null
        ? `Taken · ${transcript.grade}`
        : "Taken"
      : transcript
        ? "In progress"
        : "Planned";

  return (
    <button
      type="button"
      onClick={() => setSelection({ kind: "course", code, termId })}
      className="flex w-full items-start gap-2 rounded-xl border border-line bg-white px-2.5 py-2 text-left transition hover:border-[#c9d4ec]"
    >
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#16a34a]" />
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold">{formatCode(code)}</span>
        {title && <span className="block truncate text-[11px] text-ink-2">{title}</span>}
        <span className="mt-0.5 block text-[11px] text-ink-3">
          {status}
          {term ? ` · ${term.label} · ${sessionName(term.id)}` : ""}
        </span>
      </span>
    </button>
  );
}

function EmptyList({ group, anyHalf }: { group: GroupView; anyHalf: boolean }) {
  if (anyHalf) {
    return (
      <p className="px-4 py-6 text-[12.5px] leading-relaxed text-ink-2">
        Almost any half-credit course can fill <span className="font-medium">{group.label}</span>. Use Add course (A)
        to search the full catalog, then pin it here if needed.
      </p>
    );
  }
  return <p className="px-4 py-6 text-[12.5px] text-ink-3">No courses match these filters.</p>;
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
