import type { BrowseFilters, BrowseRow } from "@/engine/types";

export type BrowseResult = {
  header?: string;
  rows: BrowseRow[];
  truncated?: boolean;
  total?: number;
  needQuery?: boolean;
  subjects?: string[];
};

export async function postBrowseGroup(body: {
  placements: Record<string, string[]>;
  targetTermId: string;
  groupId: string;
  filters?: BrowseFilters;
  pins?: Record<string, string[]>;
}): Promise<BrowseResult> {
  const res = await fetch("/api/browse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, mode: "group" }),
  });
  if (!res.ok) throw new Error("browse failed");
  return res.json();
}

export async function postBrowseList(body: {
  placements: Record<string, string[]>;
  targetTermId: string;
  listId: string;
  filters?: BrowseFilters;
  pins?: Record<string, string[]>;
}): Promise<BrowseResult> {
  const res = await fetch("/api/browse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, mode: "list" }),
  });
  if (!res.ok) throw new Error("browse failed");
  return res.json();
}

export async function postBrowseCatalog(body: {
  placements: Record<string, string[]>;
  targetTermId: string;
  query?: string;
  offset?: number;
  limit?: number;
  filters?: BrowseFilters;
  pins?: Record<string, string[]>;
}): Promise<BrowseResult> {
  const res = await fetch("/api/browse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...body, mode: "catalog" }),
  });
  if (!res.ok) throw new Error("browse failed");
  return res.json();
}
