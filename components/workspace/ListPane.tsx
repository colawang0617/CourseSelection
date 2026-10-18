"use client";

import { useQuery } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";
import { listLabel } from "@/data/list-meta";
import { formatCode, sessionName } from "@/engine/levels";
import type { BrowseRow } from "@/engine/types";
import { usePlanner } from "@/components/PlannerProvider";
import { postBrowseCatalog, postBrowseGroup, postBrowseList } from "@/lib/browse-client";
import { CourseRow } from "./CourseRow";
import { ColumnHeader, ListToolbar } from "./ListToolbar";
import { RequirementIndex } from "./RequirementIndex";

export function ListPane() {
  const { activeList } = usePlanner();
  const isList = activeList.startsWith("list:");
  const isCatalog = activeList === "all";

  return (
    <div className="flex h-full min-h-0">
      <div className="w-[220px] shrink-0">
        <RequirementIndex />
      </div>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <ListHeader />
        {isCatalog ? (
          <CatalogTable />
        ) : isList ? (
          <ListTable listId={activeList.slice(5)} />
        ) : (
          <GroupTable groupId={activeList} />
        )}
      </div>
    </div>
  );
}

function ListHeader() {
  const { activeList, analysis, profile, targetTermId } = usePlanner();
  const term = profile.terms.find((t) => t.id === targetTermId);
  const termText = term ? `${term.label} · ${sessionName(term.id)}` : "";

  if (activeList === "all") {
    return (
      <div className="shrink-0 px-4 pt-3">
        <h2 className="text-[16px] font-semibold tracking-tight">Search all courses</h2>
        <p className="text-[12px] text-ink-2">
          Type a code or title to search the calendar · checked against {termText}
        </p>
      </div>
    );
  }

  if (activeList.startsWith("list:")) {
    const listId = activeList.slice(5);
    return (
      <div className="shrink-0 px-4 pt-3">
        <h2 className="truncate text-[16px] font-semibold tracking-tight">{listLabel(listId)}</h2>
        <p className="text-[12px] text-ink-2">Catalog list · checked against {termText}</p>
      </div>
    );
  }

  for (const cred of analysis.credentials) {
    const group = cred.groups.find((g) => g.id === activeList);
    if (!group) continue;
    const filled = Math.min(group.courses.length, group.need);
    return (
      <div className="shrink-0 px-4 pt-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="truncate text-[16px] font-semibold tracking-tight">{group.label}</h2>
          <span
            className={
              group.satisfied ? "shrink-0 text-[12px] text-[#16a34a]" : "shrink-0 text-[12px] text-ink-2"
            }
          >
            {group.satisfied ? "Complete" : `${filled} of ${group.need} done`}
          </span>
        </div>
        <p className="text-[12px] text-ink-2">
          {cred.name} · Complete {group.need === 1 ? "1 course" : `${group.need} courses`} from the following ·
          checked against {termText}
        </p>
        {group.courses.length > 0 && (
          <p className="mt-0.5 text-[12px] text-ink-2">Counting: {group.courses.map(formatCode).join(", ")}</p>
        )}
        {group.note && <p className="mt-0.5 text-[12px] text-[#b45309]">{group.note}</p>}
      </div>
    );
  }
  return null;
}

function useFilteredRows(rows: BrowseRow[]) {
  const { listQuery } = usePlanner();
  return useMemo(() => {
    const q = listQuery.trim().toLowerCase().replace(/\s+/g, "");
    if (!q) return rows;
    return rows.filter(
      (r) => r.code.toLowerCase().includes(q) || r.title.toLowerCase().replace(/\s+/g, "").includes(q),
    );
  }, [rows, listQuery]);
}

function GroupTable({ groupId }: { groupId: string }) {
  const { placements, pins, targetTermId, listFilters, setActiveList } = usePlanner();
  const { data, isFetching } = useQuery({
    queryKey: ["browse-group", groupId, placements, pins, targetTermId, listFilters],
    queryFn: () => postBrowseGroup({ placements, pins, targetTermId, groupId, filters: listFilters }),
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === groupId ? prev : undefined),
    staleTime: 20_000,
  });
  const rows = useFilteredRows(data?.rows ?? []);

  return (
    <>
      <ListToolbar subjects={data?.subjects ?? []} searchPlaceholder="Filter by code or title" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ColumnHeader />
        {!data && isFetching && <TableMessage>Loading courses…</TableMessage>}
        {data && data.rows.length === 0 && (
          <TableMessage>
            This requirement accepts almost any course, so there is no fixed list.{" "}
            <button type="button" className="text-brand hover:underline" onClick={() => setActiveList("all")}>
              Search all courses
            </button>
          </TableMessage>
        )}
        {data && data.rows.length > 0 && rows.length === 0 && (
          <TableMessage>No courses match these filters.</TableMessage>
        )}
        {rows.map((row) => (
          <CourseRow key={row.code} row={row} />
        ))}
        {data && rows.length > 0 && (
          <p className="px-4 py-2 text-[11px] text-ink-3">
            {rows.length} course{rows.length === 1 ? "" : "s"}
            {data.truncated ? " · list is long, use the filters to narrow it" : ""}
          </p>
        )}
      </div>
    </>
  );
}

function ListTable({ listId }: { listId: string }) {
  const { placements, pins, targetTermId, listFilters } = usePlanner();
  const { data, isFetching } = useQuery({
    queryKey: ["browse-list", listId, placements, pins, targetTermId, listFilters],
    queryFn: () => postBrowseList({ placements, pins, targetTermId, listId, filters: listFilters }),
    placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[1] === listId ? prev : undefined),
    staleTime: 20_000,
  });
  const rows = useFilteredRows(data?.rows ?? []);

  return (
    <>
      <ListToolbar subjects={data?.subjects ?? []} searchPlaceholder="Filter by code or title" />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ColumnHeader />
        {!data && isFetching && <TableMessage>Loading list…</TableMessage>}
        {data && data.rows.length === 0 && <TableMessage>No courses on this list.</TableMessage>}
        {data && data.rows.length > 0 && rows.length === 0 && (
          <TableMessage>No courses match these filters.</TableMessage>
        )}
        {rows.map((row) => (
          <CourseRow key={row.code} row={row} />
        ))}
        {data && rows.length > 0 && (
          <p className="px-4 py-2 text-[11px] text-ink-3">
            {rows.length} course{rows.length === 1 ? "" : "s"}
            {data.truncated ? " · showing first page — filter to narrow" : ""}
          </p>
        )}
      </div>
    </>
  );
}

const CATALOG_PAGE = 80;

function CatalogTable() {
  const { placements, pins, targetTermId, listQuery, listFilters } = usePlanner();
  const parentRef = useRef<HTMLDivElement>(null);
  const [limit, setLimit] = useState(CATALOG_PAGE);
  const queryReady = listQuery.trim().length >= 2;

  useEffect(() => {
    setLimit(CATALOG_PAGE);
  }, [listQuery, listFilters]);

  const { data, isFetching } = useQuery({
    queryKey: ["browse-catalog", placements, pins, targetTermId, listQuery, listFilters, limit],
    queryFn: () =>
      postBrowseCatalog({
        placements,
        pins,
        targetTermId,
        query: listQuery,
        offset: 0,
        limit,
        filters: listFilters,
      }),
    placeholderData: (prev) => prev,
    staleTime: 15_000,
    enabled: true,
  });

  const rows = data?.rows ?? [];
  const needQuery = data?.needQuery || !queryReady;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 16,
  });
  const canLoadMore = Boolean(data && !needQuery && data.total != null && rows.length < data.total);

  return (
    <>
      <ListToolbar
        subjects={data?.subjects ?? []}
        searchPlaceholder="Search by code or title (e.g. CS 486)"
      />
      <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
        <ColumnHeader />
        {needQuery && (
          <TableMessage>Type at least 2 characters to search the catalog (e.g. CS 486 or Algorithms).</TableMessage>
        )}
        {!needQuery && !data && isFetching && <TableMessage>Searching…</TableMessage>}
        {!needQuery && data && rows.length === 0 && <TableMessage>No courses match.</TableMessage>}
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((item) => (
            <div
              key={rows[item.index].code}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${item.start}px)`,
              }}
            >
              <CourseRow row={rows[item.index]} />
            </div>
          ))}
        </div>
        {canLoadMore && (
          <div className="px-4 py-3">
            <button
              type="button"
              className="text-[12px] font-medium text-brand hover:underline"
              onClick={() => setLimit((n) => n + CATALOG_PAGE)}
            >
              Load more ({rows.length} of {data!.total})
            </button>
          </div>
        )}
        {!needQuery && data && rows.length > 0 && !canLoadMore && (
          <p className="px-4 py-2 text-[11px] text-ink-3">
            {rows.length} course{rows.length === 1 ? "" : "s"}
          </p>
        )}
      </div>
    </>
  );
}

function TableMessage({ children }: { children: React.ReactNode }) {
  return <p className="px-4 py-3 text-[12px] text-ink-2">{children}</p>;
}
