"use client";

import { useMemo } from "react";
import { credentialsFor } from "@/data/credentials";
import { LISTS } from "@/data/lists";
import { LIST_SECTIONS, listLabel } from "@/data/list-meta";
import type { SlotGroup } from "@/engine/types";
import { usePlanner } from "@/components/PlannerProvider";
import { cn } from "@/lib/utils";

/** Groups worth surfacing as open-gap shortcuts into the picker. */
function isBrowsableGap(g: SlotGroup) {
  if (g.listRef || (g.listRefs?.length ?? 0) > 0) return true;
  if (g.codes && g.codes.length > 0 && g.codes.length <= 12) return true;
  return false;
}

export function RequirementIndex() {
  const { analysis, activeList, setActiveList, profile } = usePlanner();
  const defs = useMemo(() => credentialsFor(profile.credentials), [profile.credentials]);

  const openGaps = analysis.credentials.flatMap((cred) => {
    const def = defs.find((d) => d.id === cred.id);
    return cred.groups
      .filter((g) => {
        if (g.satisfied) return false;
        const slot = def?.groups.find((s) => s.id === g.id);
        return slot ? isBrowsableGap(slot) : false;
      })
      .map((g) => ({
        id: g.id,
        label: g.label,
        progress: `${Math.min(g.courses.length, g.need)}/${g.need}`,
        credShort: cred.short,
      }));
  });

  const knownListIds = new Set(Object.keys(LISTS));

  return (
    <nav className="h-full overflow-y-auto border-r border-line bg-[#f7f8fc]/70 px-2 py-3 text-[12px]">
      <IndexItem active={activeList === "all"} onClick={() => setActiveList("all")}>
        <span className="font-medium">Search all</span>
      </IndexItem>

      {openGaps.length > 0 && (
        <div className="mt-3">
          <SectionLabel>Open for you</SectionLabel>
          {openGaps.map((g) => (
            <IndexItem key={g.id} active={activeList === g.id} onClick={() => setActiveList(g.id)}>
              <span className="truncate" title={`${g.credShort} · ${g.label}`}>
                {g.label}
              </span>
              <span className="shrink-0 text-[11px] text-ink-3">{g.progress}</span>
            </IndexItem>
          ))}
        </div>
      )}

      <div className="mt-3">
        <SectionLabel>Lists</SectionLabel>
        {LIST_SECTIONS.map((section) => {
          const ids = section.ids.filter((id) => knownListIds.has(id));
          if (ids.length === 0) return null;
          return (
            <div key={section.section} className="mt-1.5">
              <p className="px-2 py-0.5 pl-3 text-[10.5px] font-medium uppercase tracking-wide text-ink-3">
                {section.section}
              </p>
              {ids.map((id) => {
                const key = `list:${id}`;
                return (
                  <IndexItem key={id} active={activeList === key} onClick={() => setActiveList(key)}>
                    <span className="truncate">{listLabel(id)}</span>
                    <span className="shrink-0 text-[11px] text-ink-3">
                      {LISTS[id]?.codes?.length ?? (LISTS[id]?.subjects ? "…" : "")}
                    </span>
                  </IndexItem>
                );
              })}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-ink-3">{children}</p>;
}

function IndexItem({
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
        "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-[4px] pl-3 text-left transition-colors",
        active ? "bg-brand text-white [&_span]:text-white" : "hover:bg-white/70",
      )}
    >
      {children}
    </button>
  );
}
