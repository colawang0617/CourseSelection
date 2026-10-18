import { NextResponse } from "next/server";
import { refreshRatings } from "@/lib/ratings";
import { z } from "zod";

export async function POST(request: Request) {
  const { codes } = z.object({ codes: z.array(z.string()).max(80) }).parse(await request.json());
  await refreshRatings(codes);
  return NextResponse.json({ ok: true });
}
