"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { credentialsFor } from "@/data/credentials";
import { formatCode, sessionName } from "@/engine/levels";
import { rollupHierarchy } from "@/engine/hierarchy";
import type { CredentialView, GroupView, HierarchyView } from "@/engine/types";
import { usePlanner } from "@/components/PlannerProvider";
import { CountUp } from "@/components/ui/CountUp";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { programAccent, spring } from "@/lib/theme";
import { cn } from "@/lib/utils";

const STATUS_STYLE = {
  Done: "bg-[#e3f7ea] text-[#15803d]",
  Planned: "bg-brand-soft text-brand",
  "In progress": "bg-[#fff4dc] text-[#a15c00]",
  Open: "bg-[#fff1f0] text-[#d1372c]",
} as const;

function statusFor(
  filled: number,
  satisfied: boolean,
  courses: string[],
  planned: Set<string>,
  taken: Set<string>,
): keyof typeof STATUS_STYLE {
  if (satisfied) {
    return courses.some((c) => planned.has(c) && !taken.has(c)) ? "Planned" : "Done";
  }
  if (filled > 0) return "In progress";
  return "Open";
}

export function RequirementsView() {
  const { asOfAnalysis, placements, profile, openRequirement } = usePlanner();
  const planned = new Set(Object.values(placements).flat());
  const taken = new Set(profile.transcript.map((t) => t.code));
  const defs = useMemo(() => credentialsFor(profile.credentials), [profile.credentials]);
  const majorDef = defs.find((c) => c.kind === "major");
  const majorView = asOfAnalysis.credentials.find((c) => c.id === majorDef?.id);
  const tree = useMemo(() => {
    if (!majorDef?.hierarchy || !majorView) return null;
    return rollupHierarchy(majorDef.hierarchy, majorView.groups);
  }, [majorDef, majorView]);

  const others = asOfAnalysis.credentials.filter((c) => c.id !== majorDef?.id);

  return (
    <div className="mx-auto max-w-[960px] px-6 py-6">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight">Graduation requirements</h1>
          <p className="mt-1 text-[13px] text-ink-2">
            As the calendar lists them — with the courses your plan uses for each category.
          </p>
        </div>
        <Link href="/" className="shrink-0 text-[13px] text-brand hover:underline">
          ← Workspace
        </Link>
      </div>

      {majorDef && majorView && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="surface mt-6 overflow-hidden rounded-2xl"
        >
          <UnitsHeader
            name={majorView.name}
            projected={asOfAnalysis.units.projected}
            target={asOfAnalysis.units.target ?? majorDef.units ?? null}
            accent={programAccent(asOfAnalysis.credentials, majorView.id)}
          />

          <div className="border-t border-line px-2 py-2">
            {tree ? (
              tree.map((node) => (
                <HierarchyBranch
                  key={node.id}
                  node={node}
                  cred={majorView}
                  depth={0}
                  planned={planned}
                  taken={taken}
                  defaultOpen={node.id === "electives" || !node.satisfied}
                  onOpenLeaf={(groupId) => openRequirement({ credentialId: majorView.id, groupId })}
                />
              ))
            ) : (
              <FlatGroups
                cred={majorView}
                planned={planned}
                taken={taken}
                onOpenLeaf={(groupId) => openRequirement({ credentialId: majorView.id, groupId })}
              />
            )}
          </div>
        </motion.section>
      )}

      {others.map((cred, i) => (
        <motion.section
          key={cred.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 * (i + 1) }}
          className="surface mt-4 overflow-hidden rounded-2xl"
        >
          <OtherCredentialHeader cred={cred} />
          <div className="border-t border-line px-2 py-2">
            <FlatGroups
              cred={cred}
              planned={planned}
              taken={taken}
              onOpenLeaf={(groupId) => openRequirement({ credentialId: cred.id, groupId })}
            />
          </div>
        </motion.section>
      ))}

      <p className="mt-4 text-[11px] text-ink-3">
        Gray codes are on your transcript; colored codes are planned. Open a row to pick courses.
      </p>
    </div>
  );
}

function UnitsHeader({
  name,
  projected,
  target,
  accent,
}: {
  name: string;
  projected: number;
  target: number | null;
  accent: { solid: string; soft: string };
}) {
  const pct = target ? Math.min(1, projected / target) : 0;
  return (
    <div className="px-5 py-4" style={{ background: `linear-gradient(90deg, ${accent.soft}, transparent 70%)` }}>
      <div className="flex items-center gap-4">
        <ProgressRing value={pct} color={accent.solid} size={52} stroke={5}>
          <span className="text-[11px] font-semibold tabular-nums">{Math.round(pct * 100)}%</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-semibold tracking-tight">{name}</h2>
          <p className="text-[13px] text-ink-2">
            Complete a total of{" "}
            <span className="font-semibold text-[#1b2130]">
              <CountUp value={projected} decimals={projected % 1 ? 2 : 0} />
              {target != null ? ` / ${target}` : ""}
            </span>{" "}
            units
            <span className="text-ink-3"> · excluding COOP and PD</span>
          </p>
          <div className="mt-2 h-1.5 max-w-md overflow-hidden rounded-full bg-white/80">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${pct * 100}%`, background: accent.solid }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function OtherCredentialHeader({ cred }: { cred: CredentialView }) {
  const { asOfAnalysis } = usePlanner();
  const accent = programAccent(asOfAnalysis.credentials, cred.id);
  const met = cred.groups.filter((g) => g.satisfied).length;
  return (
    <div
      className="flex items-center gap-3 px-5 py-3"
      style={{ background: `linear-gradient(90deg, ${accent.soft}, transparent 70%)` }}
    >
      <ProgressRing value={met / Math.max(1, cred.groups.length)} color={accent.solid} size={40} stroke={4}>
        <span className="text-[10px] font-semibold tabular-nums">
          {met}/{cred.groups.length}
        </span>
      </ProgressRing>
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight">{cred.name}</h2>
        <span className="text-[12px] text-ink-2">
          {met} of {cred.groups.length} requirements met
        </span>
      </div>
    </div>
  );
}

function HierarchyBranch({
  node,
  cred,
  depth,
  planned,
  taken,
  defaultOpen,
  onOpenLeaf,
}: {
  node: HierarchyView;
  cred: CredentialView;
  depth: number;
  planned: Set<string>;
  taken: Set<string>;
  defaultOpen?: boolean;
  onOpenLeaf: (groupId: string) => void;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const hasChildren = Boolean(node.children?.length);
  // Term buckets (req-*) expand even with one course so "4B" stays a heading.
  const isGroupList =
    !hasChildren &&
    node.groupIds.length > 0 &&
    (node.groupIds.length > 1 || node.id.startsWith("req-"));
  const expandable = hasChildren || isGroupList;
  const status = statusFor(node.filled, node.satisfied, node.courses, planned, taken);
  const pad = 12 + depth * 14;

  if (!expandable && node.leafGroupId) {
    const group = cred.groups.find((g) => g.id === node.leafGroupId);
    if (!group) return null;
    return (
      <LeafRow
        label={node.label}
        note={node.note}
        group={group}
        depth={depth}
        planned={planned}
        taken={taken}
        onOpen={() => onOpenLeaf(node.leafGroupId!)}
      />
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl py-2.5 pr-3 text-left transition-colors",
          expandable && "hover:bg-[#f4f6fb]",
        )}
        style={{ paddingLeft: pad }}
      >
        <ChevronRight
          className={cn(
            "h-4 w-4 shrink-0 text-ink-3 transition-transform",
            open && "rotate-90",
            !expandable && "opacity-0",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={cn("font-semibold", depth === 0 ? "text-[14px]" : "text-[13px]")}>{node.label}</span>
            <span className={cn("rounded-full px-2 py-[1px] text-[10.5px] font-medium", STATUS_STYLE[status])}>
              {status}
            </span>
          </div>
          {node.note && <p className="mt-0.5 text-[11.5px] text-ink-3">{node.note}</p>}
        </div>
        <span className="shrink-0 tabular-nums text-[12.5px] text-ink-2">
          {node.filled}/{node.need}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && expandable && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {hasChildren &&
              node.children!.map((child) => (
                <HierarchyBranch
                  key={child.id}
                  node={child}
                  cred={cred}
                  depth={depth + 1}
                  planned={planned}
                  taken={taken}
                  defaultOpen={!child.satisfied}
                  onOpenLeaf={onOpenLeaf}
                />
              ))}
            {isGroupList &&
              node.groupIds.map((gid) => {
                const group = cred.groups.find((g) => g.id === gid);
                if (!group) return null;
                return (
                  <LeafRow
                    key={gid}
                    label={group.label}
                    note={group.note}
                    group={group}
                    depth={depth + 1}
                    planned={planned}
                    taken={taken}
                    onOpen={() => onOpenLeaf(gid)}
                  />
                );
              })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LeafRow({
  label,
  note,
  group,
  depth,
  planned,
  taken,
  onOpen,
}: {
  label: string;
  note?: string;
  group: GroupView;
  depth: number;
  planned: Set<string>;
  taken: Set<string>;
  onOpen: () => void;
}) {
  const { asOfAnalysis } = usePlanner();
  const filled = Math.min(group.courses.length, group.need);
  const status = statusFor(filled, group.satisfied, group.courses, planned, taken);
  const pad = 12 + depth * 14;

  return (
    <div className="rounded-xl transition-colors hover:bg-[#f4f6fb]" style={{ paddingLeft: pad }}>
      <div className="flex items-start gap-2 py-2 pr-3">
        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c5cddc]" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[13px] font-medium">{label}</span>
            <span className={cn("rounded-full px-2 py-[1px] text-[10.5px] font-medium", STATUS_STYLE[status])}>
              {status}
            </span>
            <span className="tabular-nums text-[12px] text-ink-3">
              {filled}/{group.need}
            </span>
          </div>
          {note && <p className="mt-0.5 text-[11.5px] text-ink-3">{note}</p>}
          {group.courses.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {group.courses.map((code) => (
                <CourseChip key={code} code={code} taken={taken.has(code)} title={asOfAnalysis.titles?.[code]} />
              ))}
            </div>
          )}
        </div>
        {!group.satisfied && (
          <button
            type="button"
            onClick={onOpen}
            className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[11.5px] font-medium text-brand transition hover:bg-brand hover:text-white"
          >
            Find courses
          </button>
        )}
      </div>
    </div>
  );
}

function CourseChip({ code, taken, title }: { code: string; taken: boolean; title?: string }) {
  const { asOfAnalysis, profile, setSelection } = usePlanner();
  const termId = asOfAnalysis.termOf?.[code];
  const term = profile.terms.find((t) => t.id === termId);
  return (
    <button
      type="button"
      title={[title, term ? `${term.label} · ${sessionName(term.id)}` : ""].filter(Boolean).join(" · ")}
      onClick={() => setSelection({ kind: "course", code, termId })}
      className={cn(
        "whitespace-nowrap rounded-md px-1.5 py-[2px] text-[11.5px] font-medium transition hover:brightness-[0.97]",
        taken ? "bg-[#f1f3f8] text-[#1b2130]" : "bg-brand-soft text-brand",
      )}
    >
      {formatCode(code)}
    </button>
  );
}

function FlatGroups({
  cred,
  planned,
  taken,
  onOpenLeaf,
}: {
  cred: CredentialView;
  planned: Set<string>;
  taken: Set<string>;
  onOpenLeaf: (groupId: string) => void;
}) {
  return (
    <>
      {cred.groups.map((group) => (
        <LeafRow
          key={group.id}
          label={group.label}
          note={group.note}
          group={group}
          depth={0}
          planned={planned}
          taken={taken}
          onOpen={() => onOpenLeaf(group.id)}
        />
      ))}
    </>
  );
}
