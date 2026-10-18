import { NextResponse } from "next/server";
import { z } from "zod";
import { browseCatalog, browseGroup, browseList } from "@/engine/browse";
import { credentialsFor } from "@/data/credentials";
import { loadCatalogs, loadInvalid, loadLists, loadOfferings, loadProfile, loadRatings } from "@/lib/store";

const filtersSchema = z
  .object({
    offeredOnly: z.boolean().optional(),
    prereqsMet: z.boolean().optional(),
    hideTakenPlanned: z.boolean().optional(),
    subject: z.string().optional(),
    levelMin: z.number().optional(),
    levelMax: z.number().optional(),
    sort: z.enum(["fit", "code", "liked"]).optional(),
  })
  .optional();

const bodySchema = z.object({
  placements: z.record(z.string(), z.array(z.string())).default({}),
  targetTermId: z.string(),
  mode: z.enum(["group", "catalog", "list"]),
  groupId: z.string().optional(),
  listId: z.string().optional(),
  query: z.string().optional(),
  offset: z.number().optional(),
  limit: z.number().optional(),
  filters: filtersSchema,
  pins: z.record(z.string(), z.array(z.string())).optional(),
});

export async function POST(request: Request) {
  const json = bodySchema.parse(await request.json());
  const profile = loadProfile("me");
  const ratings = loadRatings();
  const liked: Record<string, { liked: number | null }> = {};
  for (const [code, info] of Object.entries(ratings)) liked[code] = { liked: info.liked };

  const base = {
    profile,
    credentials: credentialsFor(profile.credentials),
    placements: json.placements,
    lists: loadLists(),
    catalogs: loadCatalogs(),
    offerings: loadOfferings(),
    ratings: liked,
    invalidRows: loadInvalid(),
    targetTermId: json.targetTermId,
    pins: json.pins,
  };

  if (json.mode === "group" && json.groupId) {
    const result = await browseGroup(base, json.groupId, json.filters);
    return NextResponse.json(result);
  }

  if (json.mode === "list" && json.listId) {
    const result = await browseList(base, json.listId, json.filters);
    return NextResponse.json(result);
  }

  const result = await browseCatalog(
    base,
    json.query ?? "",
    json.filters,
    json.offset ?? 0,
    json.limit ?? 80,
  );
  return NextResponse.json(result);
}
