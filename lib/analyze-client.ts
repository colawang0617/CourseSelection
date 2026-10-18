import type { Analysis } from "@/engine/types";

export async function postAnalysis(body: unknown): Promise<Analysis> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("analyze failed");
  return res.json();
}
