import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { deleteScenario, listScenarios, saveScenario } from "@/lib/store";
import type { Scenario } from "@/engine/types";
import { z } from "zod";

export async function GET() {
  return NextResponse.json(listScenarios());
}

const saveSchema = z.object({
  id: z.string(),
  name: z.string(),
  placements: z.record(z.string(), z.array(z.string())),
  pins: z.record(z.string(), z.array(z.string())).optional(),
});

export async function PUT(request: Request) {
  const raw = await request.text();
  if (!raw) return NextResponse.json({ error: "empty" }, { status: 400 });
  const scenario = saveSchema.parse(JSON.parse(raw)) satisfies Scenario;
  saveScenario(scenario);
  return NextResponse.json(scenario);
}

export async function POST(request: Request) {
  const { fromId } = z.object({ fromId: z.string() }).parse(await request.json());
  const source = listScenarios().find((s) => s.id === fromId);
  if (!source) return NextResponse.json({ error: "missing" }, { status: 404 });
  const copy: Scenario = {
    id: randomUUID().slice(0, 8),
    name: `${source.name} copy`,
    placements: structuredClone(source.placements),
    pins: structuredClone(source.pins ?? {}),
  };
  saveScenario(copy);
  return NextResponse.json(copy);
}

export async function PATCH(request: Request) {
  const body = z.object({ id: z.string(), name: z.string() }).parse(await request.json());
  const existing = listScenarios().find((s) => s.id === body.id);
  if (!existing) return NextResponse.json({ error: "missing" }, { status: 404 });
  const updated = { ...existing, name: body.name };
  saveScenario(updated);
  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const { id } = z.object({ id: z.string() }).parse(await request.json());
  const all = listScenarios();
  if (all.length <= 1) return NextResponse.json({ error: "last plan" }, { status: 400 });
  if (!all.some((s) => s.id === id)) return NextResponse.json({ error: "missing" }, { status: 404 });
  deleteScenario(id);
  return NextResponse.json({ ok: true });
}
