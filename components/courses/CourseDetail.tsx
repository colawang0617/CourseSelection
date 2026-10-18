"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatCode, sessionLabel } from "@/engine/levels";
import { usePlanner } from "@/components/PlannerProvider";
import { coversLine } from "@/lib/covers";
import { academicCalendarUrl, uwflowUrl } from "@/lib/course-links";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";

interface Detail {
  code: string;
  title: string;
  description: string;
  credits: number;
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
    comments: { text: string; createdAt: string }[];
    seasons: string[];
  } | null;
}

export function CourseDetail({ code }: { code: string }) {
  const { analysis, profile, targetTermId, addCourse, placements } = usePlanner();
  const detail = useQuery({
    queryKey: ["course", code],
    queryFn: async () => {
      const res = await fetch(`/api/course?code=${encodeURIComponent(code)}`);
      if (!res.ok) throw new Error("missing");
      return (await res.json()) as Detail;
    },
  });

  const term = profile.terms.find((t) => t.id === targetTermId);
  const onTranscript = profile.transcript.some((c) => c.code === code);
  const alreadyPlaced = Object.values(placements).flat().includes(code);
  const canAdd = !onTranscript && !alreadyPlaced;
  const covered = coversLine(analysis, code);
  const problems = analysis.problems.filter((p) => p.code === code && p.severity === "error");
  const calendar = academicCalendarUrl(code);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/" className="text-sm text-[#0071e3]">
          ← Workspace
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{formatCode(code)}</h1>
        <p className="text-[#6e6e73]">{detail.data?.title ?? "Loading…"}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <a
            href={uwflowUrl(code)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#0071e3] hover:underline"
          >
            UWFlow
          </a>
          {calendar && (
            <a href={calendar} target="_blank" rel="noopener noreferrer" className="text-[#0071e3] hover:underline">
              Academic Calendar
            </a>
          )}
        </div>
        {canAdd && term && (
          <Button className="mt-4" onClick={() => addCourse(code, targetTermId)}>
            Add to {term.label} · {sessionLabel(targetTermId)}
          </Button>
        )}
      </div>

      <Card>
        <CardTitle>Covers in your plan</CardTitle>
        {covered ? <p className="mt-2 text-sm">{covered}</p> : <p className="mt-2 text-sm text-[#6e6e73]">Not assigned to a requirement yet.</p>}
        {problems.length > 0 && (
          <ul className="mt-2 text-sm text-[#9f1239]">
            {problems.map((p) => (
              <li key={p.message}>{p.message}</li>
            ))}
          </ul>
        )}
      </Card>

      {(detail.data?.prereqs.length || detail.data?.prereqText) && (
        <Card>
          <CardTitle>Before you can take it</CardTitle>
          {detail.data?.prereqs.length ? (
            <p className="mt-2 text-sm">{detail.data.prereqs.map((c) => formatCode(c)).join(", ")}</p>
          ) : null}
          {detail.data?.prereqText && <p className="mt-2 text-sm text-[#6e6e73]">{detail.data.prereqText}</p>}
          {detail.data?.coreqText && <p className="mt-2 text-sm text-[#6e6e73]">Take with: {detail.data.coreqText}</p>}
        </Card>
      )}

      {detail.data?.unlocks.length ? (
        <Card>
          <CardTitle>Unlocks</CardTitle>
          <p className="mt-2 text-sm">
            {detail.data.unlocks.map((c) => (
              <Link key={c} href={`/courses/${c}`} className="mr-2 text-[#0071e3]">
                {formatCode(c)}
              </Link>
            ))}
          </p>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Offerings</CardTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          {(detail.data?.terms ?? []).map((t) => (
            <span key={t.id} className="rounded-lg bg-[#f5f5f7] px-2 py-1 text-xs">
              {t.label || sessionLabel(t.id)} · {t.status}
            </span>
          ))}
        </div>
      </Card>

      {detail.data?.rating && (
        <Card>
          <CardTitle>What students say</CardTitle>
          <p className="mt-2 text-sm text-[#6e6e73]">
            Liked {detail.data.rating.liked != null ? `${Math.round(detail.data.rating.liked * 100)}%` : "—"}
          </p>
          {detail.data.rating.comments.slice(0, 3).map((c) => (
            <p key={c.createdAt} className="mt-3 text-sm text-[#6e6e73]">
              {c.text}
            </p>
          ))}
        </Card>
      )}

      {detail.data?.description && (
        <Card>
          <CardTitle>About</CardTitle>
          <p className="mt-2 text-sm leading-relaxed text-[#6e6e73]">{detail.data.description}</p>
        </Card>
      )}
    </div>
  );
}
