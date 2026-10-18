"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { formatCode, sessionName } from "@/engine/levels";
import type { GroupView } from "@/engine/types";
import { usePlanner } from "@/components/PlannerProvider";
import { postBrowseGroup } from "@/lib/browse-client";
import { cn } from "@/lib/utils";
import { CourseRow } from "./CourseRow";
import { ColumnHeader } from "./ListToolbar";

const KIND_LABEL = { major: "Degree requirements", specialization: "Specialization", minor: "Minor", option: "Option" };

export function ProgramView({ credId }: { credId: string }) {
  const { analysis } = usePlanner();
  const cred = analysis.credentials.find((c) => c.id === credId);
  if (!cred) return null;
  const met = cred.groups.filter((g) => g.satisfied).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="border-b border-[#ebebed] px-3 py-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="truncate text-[14px] font-semibold">{cred.name}</h2>
          <span className={cn("shrink-0 text-[12px]", cred.complete ? "text-[#248a3d]" : "text-[#6e6e73]")}>
            {met} of {cred.groups.length} requirements met
          </span>
        </div>
        <p className="text-[12px] text-[#6e6e73]">{KIND_LABEL[cred.kind]} · as the calendar lists them, with your courses</p>
        <div className="mt-1.5 h-1 overflow-hidden rounded bg-[#ebebed]">
          <div className="h-full bg-[#0071e3]" style={{ width: `${(met / Math.max(1, cred.groups.length)) * 100}%` }} />
        </div>
      </div>
      {cred.groups.map((group, i) => (
        <RequirementBlock key={group.id} group={group} index={i + 1} />
      ))}
    </div>
  );
}

function RequirementBlock({ group, index }: { group: GroupView; index: number }) {
  const { analysis, profile, setActiveList } = usePlanner();
  const [showOptions, setShowOptions] = useState(!group.satisfied);
  const transcript = new Map(profile.transcript.map((t) => [t.code, t]));
  const termOf = analysis.termOf ?? {};
  const remaining = Math.max(0, group.need - group.courses.length);
  const allTaken = group.courses.every((c) => transcript.get(c)?.status === "complete");
  const status = group.satisfied ? (allTaken ? "Done" : "Planned") : group.courses.length ? "In progress" : "Open";

  return (
    <section className="border-b border-[#ebebed] px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="w-5 shrink-0 text-[11px] tabular-nums text-[#aeaeb2]">{index}.</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate text-[13px] font-semibold">{group.label}</h3>
            <span
              className={cn(
                "shrink-0 text-[12px] font-medium",
                status === "Done" && "text-[#248a3d]",
                status === "Planned" && "text-[#0060c0]",
                status === "In progress" && "text-[#b45309]",
                status === "Open" && "text-[#c9302c]",
              )}
            >
              {status} · {Math.min(group.courses.length, group.need)}/{group.need}
            </span>
          </div>
          <p className="text-[12px] text-[#6e6e73]">
            Complete {group.need === 1 ? "1 course" : `${group.need} courses`}
            {remaining > 0 && group.courses.length > 0 ? ` · ${remaining} more needed` : ""}
          </p>
          {group.note && <p className="text-[12px] text-[#b45309]">{group.note}</p>}

          {group.courses.length > 0 && (
            <table className="mt-1 w-full table-fixed text-[12px]">
              <tbody>
                {group.courses.map((code) => {
                  const t = transcript.get(code);
                  const termId = t?.term ?? termOf[code];
                  const term = profile.terms.find((x) => x.id === termId);
                  return (
                    <tr key={code} className="border-t border-[#f0f0f2]">
                      <td className="w-[84px] py-1 font-semibold">{formatCode(code)}</td>
                      <td className="truncate py-1 pr-3 text-[#3a3a3c]">{analysis.titles?.[code] ?? ""}</td>
                      <td className="w-[132px] truncate py-1 text-[#6e6e73]">
                        {term ? `${term.label} · ${sessionName(term.id)}` : ""}
                      </td>
                      <td className="w-[84px] py-1 text-right">
                        {t?.status === "complete" ? (
                          <span className="text-[#248a3d]">Taken{t.grade != null ? ` · ${t.grade}` : ""}</span>
                        ) : t ? (
                          <span className="text-[#b45309]">In progress</span>
                        ) : (
                          <span className="text-[#0060c0]">Planned</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="mt-1 flex gap-3 text-[12px]">
            {!group.satisfied && (
              <button type="button" className="text-[#0071e3] hover:underline" onClick={() => setShowOptions((v) => !v)}>
                {showOptions ? "Hide options" : "Show options"}
              </button>
            )}
            <button type="button" className="text-[#0071e3] hover:underline" onClick={() => setActiveList(group.id)}>
              {group.satisfied ? "See other courses that count" : "Open full list"}
            </button>
          </div>
          {showOptions && !group.satisfied && <GroupOptions groupId={group.id} />}
        </div>
      </div>
    </section>
  );
}

function GroupOptions({ groupId }: { groupId: string }) {
  const { placements, pins, targetTermId, setActiveList } = usePlanner();
  const filters = { hideTakenPlanned: true, sort: "fit" as const };
  const { data } = useQuery({
    queryKey: ["browse-group", groupId, placements, pins, targetTermId, filters],
    queryFn: () => postBrowseGroup({ placements, pins, targetTermId, groupId, filters }),
    staleTime: 20_000,
  });
  if (!data) return <p className="py-1.5 text-[12px] text-[#86868b]">Loading options…</p>;
  if (data.rows.length === 0) {
    return (
      <p className="py-1.5 text-[12px] text-[#6e6e73]">
        Almost any course counts here.{" "}
        <button type="button" className="text-[#0071e3] hover:underline" onClick={() => setActiveList("all")}>
          Search all courses
        </button>
      </p>
    );
  }
  const shown = data.rows.slice(0, 8);
  return (
    <div className="mt-1.5 overflow-hidden rounded border border-[#e5e5ea]">
      <ColumnHeader sticky={false} />
      {shown.map((row) => (
        <CourseRow key={row.code} row={row} />
      ))}
      {data.rows.length > shown.length && (
        <button
          type="button"
          className="w-full px-2 py-1 text-left text-[11px] text-[#0071e3] hover:bg-[#f5f9ff]"
          onClick={() => setActiveList(groupId)}
        >
          {data.rows.length - shown.length} more options in the full list
        </button>
      )}
    </div>
  );
}
