import { NextResponse } from "next/server";
import { loadProfile, runAnalysis } from "@/lib/store";
import { z } from "zod";

const bodySchema = z.object({
  placements: z.record(z.string(), z.array(z.string())).default({}),
  activeTermId: z.string().optional(),
  asOfTermId: z.string().optional(),
  query: z.string().optional(),
  filterGroupId: z.string().optional(),
  suggest: z.boolean().optional(),
  pins: z.record(z.string(), z.array(z.string())).optional(),
});

export async function POST(request: Request) {
  const json = bodySchema.parse(await request.json());
  const profile = loadProfile("me");
  const analysis = await runAnalysis({ profile, ...json });
  return NextResponse.json(analysis);
}
