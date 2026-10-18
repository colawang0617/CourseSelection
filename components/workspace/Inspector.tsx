"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { credentialsFor } from "@/data/credentials";
import { formatCode, sessionName } from "@/engine/levels";
import { stillOpenSections } from "@/engine/hierarchy";
import { usePlanner } from "@/components/PlannerProvider";
import { CountUp } from "@/components/ui/CountUp";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { academicCalendarUrl, uwflowUrl } from "@/lib/course-links";
import { coversLine } from "@/lib/covers";
import { programAccent, spring } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface CourseInfo {
  title: string;
  credits: number;
  description: string;
  prereqText: string;
  coreqText: string;
  antireqText: string;
  prereqs: string[];
  unlocks: string[];
  terms: { id: string; label: string; status: string }[];
  rating: {
    liked: number | null;
    easy: number | null;
    useful: number | null;
    filled?: number;
    comments: { text: string; createdAt: string }[];
  } | null;
}

export function Inspector() {
  const { selection } = usePlanner();
  return (
    <aside className="surface h-full min-h-0 overflow-y-auto rounded-2xl">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={selection?.kind === "course" ? selection.code : "summary"}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.16 }}
        >
          {selection?.kind === "course" ? <CourseInspector code={selection.code} /> : <PlanSummary />}
        </motion.div>
      </AnimatePresence>
    </aside>
  );
}

function Section({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3">
      <h3 className="mb-1 text-[11px] font-semibold text-ink-3">{title}</h3>
      {children}
    </section>
  );
}

export function CourseInspector({ code }: { code: string }) {
  const {
    analysis,
    profile,
    placements,
    targetTermId,
    addCourse,
    removeCourse,
    moveCourse,
    setSelection,
    selection,
  } = usePlanner();
  const info = useQuery({
    queryKey: ["course", code],
    queryFn: async () => {
      const res = await fetch(`/api/course?code=${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error("missing");
      return (await res.json()) as CourseInfo;
    },
    staleTime: 60_000,
  });

  const taken = profile.transcript.find((t) => t.code === code);
  const plannedTerm = Object.entries(placements).find(([, codes]) => codes.includes(code))?.[0];
  const studyTerms = profile.terms.filter((t) => t.kind === "study" && t.status !== "past");
  const covers = coversLine(analysis, code);
  const prospectiveFills =
    selection?.kind === "course" && selection.code === code ? selection.fills : undefined;
  const problems = analysis.problems.filter((p) => p.code === code);
  const earlier = new Set<string>([
    ...profile.transcript.map((t) => t.code),
    ...Object.entries(placements)
      .filter(([termId]) => termId < (plannedTerm ?? targetTermId))
      .flatMap(([, codes]) => codes),
  ]);
  const termLabel = (id: string) => profile.terms.find((t) => t.id === id)?.label ?? id;
  const d = info.data;

  return (
    <div>
      <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold tracking-tight">{formatCode(code)}</h2>
          <p className="text-[12px] text-[#2a3142]">{d?.title ?? analysis.titles?.[code] ?? ""}</p>
          {d && <p className="text-[11px] text-ink-3">{d.credits} units</p>}
        </div>
        <button
          type="button"
          className="rounded p-1 text-ink-3 hover:bg-[#f1f3f8]"
          onClick={() => setSelection(null)}
          title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-line px-4 py-3">
        {taken ? (
          <p className="text-[12px] text-ink-2">
            Taken in {termLabel(taken.term)}
            {taken.grade != null ? ` · grade ${taken.grade}` : ""}
          </p>
        ) : plannedTerm ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-ink-2">Planned for {termLabel(plannedTerm)}. Move to</span>
            {studyTerms
              .filter((t) => t.id !== plannedTerm)
              .map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="h-6 rounded-full border border-line px-2 text-[12px] hover:border-brand hover:text-brand"
                  onClick={() => moveCourse(code, plannedTerm, t.id)}
                >
                  {t.label}
                </button>
              ))}
            <button
              type="button"
              className="h-6 rounded-full border border-line px-2 text-[12px] text-[#c9302c] hover:border-[#c9302c]"
              onClick={() => {
                removeCourse(code, plannedTerm);
                setSelection(null);
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-ink-2">Add to</span>
            {studyTerms.map((t) => (
              <button
                key={t.id}
                type="button"
                className={cn(
                  "h-6 rounded-full border px-2 text-[12px]",
                  t.id === targetTermId
                    ? "border-brand bg-brand text-white"
                    : "border-line hover:border-brand hover:text-brand",
                )}
                onClick={() => addCourse(code, t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {(taken || plannedTerm) && <CountsToward code={code} />}

      {!(taken || plannedTerm) && (
        <WouldCountToward
          fills={prospectiveFills}
          eligible={analysis.eligibleFor?.[code]}
          covers={covers}
        />
      )}

      {problems.length > 0 && (
        <Section title="Problems">
          {problems.map((p, i) => (
            <p key={i} className={cn("text-[12px]", p.severity === "error" ? "text-[#c9302c]" : "text-[#b45309]")}>
              {p.message}
            </p>
          ))}
        </Section>
      )}

      {d && (d.prereqText || d.coreqText || d.antireqText) && (
        <Section title="Requisites">
          {d.prereqText && <RequisiteText text={d.prereqText} have={earlier} />}
          {d.coreqText && (
            <p className="mt-1.5 text-[11px] leading-snug text-ink-2">
              <span className="font-medium text-[#2a3142]">Take with: </span>
              {d.coreqText}
            </p>
          )}
          {d.antireqText && (
            <p className="mt-1.5 text-[11px] leading-snug text-ink-2">
              <span className="font-medium text-[#2a3142]">Not with: </span>
              {d.antireqText}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-ink-3">Green codes are taken or planned earlier.</p>
        </Section>
      )}

      {d && d.terms.length > 0 && (
        <Section title="Schedule">
          <div className="flex flex-wrap gap-1">
            {d.terms.map((t) => (
              <span
                key={t.id}
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[11px]",
                  t.status === "offered"
                    ? "border-[#b7e1c1] text-[#248a3d]"
                    : t.status === "absent"
                      ? "border-[#f1b0ab] text-[#c9302c]"
                      : "border-[#e5e5ea] text-ink-3",
                )}
              >
                {t.label || sessionName(t.id)}: {t.status === "offered" ? "offered" : t.status === "absent" ? "not offered" : "unknown"}
              </span>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-ink-3">Only terms with a posted schedule are shown.</p>
        </Section>
      )}

      {d?.rating && (
        <Section title="Student ratings">
          <div className="flex gap-3 text-[12px]">
            <Stat label="Liked" value={d.rating.liked} />
            <Stat label="Easy" value={d.rating.easy} />
            <Stat label="Useful" value={d.rating.useful} />
          </div>
          {d.rating.comments.slice(0, 3).map((c) => (
            <p key={c.createdAt} className="mt-1.5 line-clamp-3 text-[11px] leading-snug text-[#2a3142]">
              “{c.text}”
            </p>
          ))}
        </Section>
      )}

      {d && d.unlocks.length > 0 && (
        <Section title="Leads to">
          <div className="flex flex-wrap gap-1">
            {d.unlocks.map((u) => (
              <button
                key={u}
                type="button"
                className="rounded border border-[#e5e5ea] px-1.5 py-0.5 text-[11px] hover:border-brand hover:text-brand"
                onClick={() => setSelection({ kind: "course", code: u })}
              >
                {formatCode(u)}
              </button>
            ))}
          </div>
        </Section>
      )}

      {d?.description && (
        <Section title="Description">
          <p className="text-[11px] leading-snug text-[#2a3142]">{d.description}</p>
        </Section>
      )}

      <CourseExternalLinks code={code} />
    </div>
  );
}

function CourseExternalLinks({ code }: { code: string }) {
  const calendar = academicCalendarUrl(code);
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 py-3 text-[12px]">
      <a
        href={uwflowUrl(code)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand hover:underline"
      >
        UWFlow
      </a>
      {calendar && (
        <a href={calendar} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
          Academic Calendar
        </a>
      )}
    </div>
  );
}

function WouldCountToward({
  fills,
  eligible,
  covers,
}: {
  fills?: { short: string; label: string }[];
  eligible?: { credentialId: string; groupId: string; label: string; overlap?: boolean }[];
  covers: string;
}) {
  if (fills && fills.length > 0) {
    return (
      <Section title="Would count toward">
        <ul className="space-y-1">
          {fills.map((f) => (
            <li key={`${f.short}-${f.label}`} className="text-[12px] text-[#2a3142]">
              {f.short ? (
                <>
                  <span className="font-medium">{f.short}</span>
                  <span className="text-ink-3"> · {f.label}</span>
                </>
              ) : (
                f.label
              )}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] text-ink-3">Impact if you add this course to your plan.</p>
      </Section>
    );
  }
  if (eligible && eligible.length > 0) {
    return (
      <Section title="Would count toward">
        <ul className="space-y-1">
          {eligible.map((e) => (
            <li key={`${e.credentialId}:${e.groupId}`} className="text-[12px] text-[#2a3142]">
              {e.label}
            </li>
          ))}
        </ul>
      </Section>
    );
  }
  if (covers) {
    return (
      <Section title="In your plan">
        <p className="text-[12px]">Counts toward {covers}</p>
      </Section>
    );
  }
  return (
    <Section title="Would count toward">
      <p className="text-[12px] text-ink-2">No open requirement in your programs would use this course right now.</p>
    </Section>
  );
}

function CountsToward({ code }: { code: string }) {
  const { analysis, profile, pins, setCoursePins, showToast } = usePlanner();
  const options = analysis.eligibleFor?.[code] ?? [];
  const used = new Set((analysis.countsFor[code] ?? []).map((u) => `${u.credentialId}:${u.groupId}`));
  const pinned = pins[code];
  const chosen = new Set(pinned ?? used);
  const strict = profile.settings.counting === "strict";

  if (options.length === 0) {
    return (
      <Section title="Counts toward">
        <p className="text-[12px] text-ink-2">No requirement in your programs accepts this course.</p>
      </Section>
    );
  }

  function toggle(credentialId: string, groupId: string, overlap?: boolean) {
    const key = `${credentialId}:${groupId}`;
    const next = new Set(chosen);
    if (next.has(key)) {
      next.delete(key);
    } else {
      if (!overlap) {
        for (const k of [...next]) {
          const other = options.find((o) => `${o.credentialId}:${o.groupId}` === k);
          if (k.startsWith(`${credentialId}:`) && !other?.overlap) next.delete(k);
        }
      }
      next.add(key);
      const programs = new Set([...next].map((k) => k.split(":")[0]));
      if (strict && programs.size > 2) {
        showToast("A course can count toward at most two programs. Uncheck one first.");
        return;
      }
    }
    setCoursePins(code, [...next]);
  }

  const missed = [...chosen].filter((k) => !used.has(k));

  return (
    <Section title="Counts toward">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] text-ink-2">
          {pinned ? "Your choice" : "Automatic: your degree first, then options and minors"}
        </span>
        {pinned && (
          <button
            type="button"
            className="text-[11px] text-brand hover:underline"
            onClick={() => setCoursePins(code, null)}
          >
            Reset to automatic
          </button>
        )}
      </div>
      {analysis.credentials
        .filter((cred) => options.some((o) => o.credentialId === cred.id))
        .map((cred) => (
          <div key={cred.id} className="mt-1.5">
            <div className="text-[11px] font-medium text-[#2a3142]">{cred.name}</div>
            {options
              .filter((o) => o.credentialId === cred.id)
              .map((o) => {
                const key = `${o.credentialId}:${o.groupId}`;
                const group = cred.groups.find((g) => g.id === o.groupId);
                const others = group ? group.courses.filter((c) => c !== code) : [];
                const full = group ? others.length >= group.need : false;
                return (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-[12px] hover:bg-[#f1f3f8]"
                  >
                    <input
                      type="checkbox"
                      checked={chosen.has(key)}
                      onChange={() => toggle(o.credentialId, o.groupId, o.overlap)}
                      className="h-3.5 w-3.5 accent-[#0071e3]"
                    />
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {used.has(key) ? (
                      <span className="text-[11px] text-[#248a3d]">counting</span>
                    ) : full ? (
                      <span className="truncate text-[11px] text-ink-3" title="Choosing this moves that course elsewhere">
                        has {others.map(formatCode).join(", ")}
                      </span>
                    ) : null}
                  </label>
                );
              })}
          </div>
        ))}
      {missed.length > 0 && (
        <p className="mt-1.5 text-[11px] text-[#b45309]">
          Can&apos;t count toward{" "}
          {missed
            .map((k) => options.find((o) => `${o.credentialId}:${o.groupId}` === k)?.label ?? k)
            .join(", ")}{" "}
          right now. That requirement is already full, or the course is already used twice.
        </p>
      )}
      {strict && <p className="mt-1.5 text-[11px] text-ink-3">One requirement per program, at most two programs.</p>}
    </Section>
  );
}

function RequisiteText({ text, have }: { text: string; have: Set<string> }) {
  const [open, setOpen] = useState(false);
  const parts = text.split(/\b([A-Z]{2,6}\s?\d{3}[A-Z]?)\b/g);
  const long = text.length > 220;
  return (
    <div>
      <p className={cn("text-[11px] leading-snug text-[#2a3142]", long && !open && "line-clamp-5")}>
        {parts.map((part, i) => {
          if (i % 2 === 0) return part;
          const code = part.replace(/\s/g, "");
          return (
            <span key={i} className={cn("font-medium", have.has(code) ? "text-[#248a3d]" : "text-[#1d1d1f]")}>
              {part}
            </span>
          );
        })}
      </p>
      {long && (
        <button type="button" className="text-[11px] text-brand hover:underline" onClick={() => setOpen(!open)}>
          {open ? "Show less" : "Show all"}
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="text-[14px] font-semibold tabular-nums">{value != null ? `${Math.round(value * 100)}%` : "–"}</div>
      <div className="text-[11px] text-ink-3">{label}</div>
    </div>
  );
}

function PlanSummary() {
  const { asOfAnalysis, asOfDisplayTermId, profile, openRequirement, setSelection } = usePlanner();
  const asOfLabel = profile.terms.find((t) => t.id === asOfDisplayTermId)?.label;
  const errors = asOfAnalysis.problems.filter((p) => p.severity === "error");
  const defs = credentialsFor(profile.credentials);
  const openCount = asOfAnalysis.credentials.reduce(
    (n, c) => n + c.groups.filter((g) => !g.satisfied).length,
    0,
  );

  const stillOpenBlocks = asOfAnalysis.credentials.flatMap((cred) => {
    const def = defs.find((d) => d.id === cred.id);
    const sections = stillOpenSections(cred, def?.hierarchy);
    const accent = programAccent(asOfAnalysis.credentials, cred.id);
    return sections.map((s) => ({
      key: `${cred.id}:${s.section}`,
      section: def?.hierarchy ? s.section : cred.short,
      groups: s.groups,
      credId: cred.id,
      accent,
    }));
  });

  return (
    <div className="p-4">
      <h2 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-2">
        Your programs
        {asOfLabel && <span className="font-medium normal-case tracking-normal text-ink-3"> · as of {asOfLabel}</span>}
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {asOfAnalysis.credentials.map((cred) => {
          const done = cred.groups.filter((g) => g.satisfied).length;
          const accent = programAccent(asOfAnalysis.credentials, cred.id);
          const firstOpen = cred.groups.find((g) => !g.satisfied);
          return (
            <motion.button
              key={cred.id}
              type="button"
              whileHover={{ y: -2 }}
              transition={spring}
              onClick={() =>
                firstOpen
                  ? openRequirement({ credentialId: cred.id, groupId: firstOpen.id })
                  : undefined
              }
              title={firstOpen ? `See what’s open in ${cred.name}` : `${cred.name} is complete`}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-line bg-white px-2 py-3 text-center transition-shadow hover:shadow-soft"
            >
              <ProgressRing value={done / Math.max(1, cred.groups.length)} color={accent.solid}>
                {cred.complete ? (
                  <Check className="h-5 w-5" style={{ color: accent.solid }} />
                ) : (
                  <span className="text-[13px] font-semibold tabular-nums">
                    <CountUp key={`${asOfDisplayTermId}:${cred.id}`} value={done} />
                    <span className="text-ink-3">/{cred.groups.length}</span>
                  </span>
                )}
              </ProgressRing>
              <span className="line-clamp-2 text-[11.5px] font-medium leading-tight">{cred.name}</span>
            </motion.button>
          );
        })}
      </div>

      {errors.length > 0 && (
        <>
          <h3 className="mb-1.5 mt-5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-2">
            Needs attention
          </h3>
          <ul className="space-y-1">
            {errors.map((p, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full rounded-lg bg-[#fff1f0] px-2.5 py-1.5 text-left text-[12px] text-[#9f1f17] hover:brightness-[0.98]"
                  onClick={() => setSelection({ kind: "course", code: p.code, termId: p.termId })}
                >
                  <span className="font-semibold">{formatCode(p.code)}</span> {p.message}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h3 className="mb-1.5 mt-5 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-2">
        Still open {openCount > 0 && <span className="text-ink-3">({openCount})</span>}
      </h3>
      {openCount === 0 ? (
        <p className="text-[12px] text-[#16a34a]">Every requirement is covered.</p>
      ) : (
        <div className="space-y-3">
          {stillOpenBlocks.map((block) => (
            <div key={block.key}>
              <div className="mb-0.5 px-2 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-3">
                {block.section}
              </div>
              <ul className="space-y-0.5">
                {block.groups.map((group) => (
                  <li key={`${block.credId}:${group.id}`}>
                    <button
                      type="button"
                      onClick={() => openRequirement({ credentialId: block.credId, groupId: group.id })}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors hover:bg-white"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: block.accent.solid }} />
                      <span className="min-w-0 flex-1 truncate">{group.label}</span>
                      <span className="shrink-0 tabular-nums text-ink-3">
                        {Math.min(group.courses.length, group.need)}/{group.need}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
