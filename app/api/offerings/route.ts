import { NextResponse } from "next/server";
import { refreshOfferings } from "@/lib/schedule";
import { z } from "zod";

export async function POST(request: Request) {
  const { codes } = z.object({ codes: z.array(z.string()).max(80) }).parse(await request.json());
  const book = await refreshOfferings(codes);
  return NextResponse.json({ postedTerms: book.postedTerms });
}
