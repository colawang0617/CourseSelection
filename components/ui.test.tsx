import { readFileSync, readdirSync } from "fs";
import path from "path";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Analysis } from "@/engine/types";
import { RequirementsView } from "./requirements/RequirementsView";
import { PlannerProvider } from "./PlannerProvider";

const forbidden = /Software Engineering|Artificial Intelligence|Combinatorics|Human-Computer/;

describe("interface stays generic", () => {
  it("does not name a program in the view code", () => {
    for (const root of ["components", "app"]) {
      for (const file of walk(path.join(process.cwd(), root))) {
        if (!/\.(tsx|ts)$/.test(file) || file.endsWith("ui.test.tsx")) continue;
        expect(readFileSync(file, "utf8"), file).not.toMatch(forbidden);
      }
    }
  });

  it("renders whatever credentials it is given", () => {
    const analysis = {
      units: { earned: 0.5, projected: 0.5, target: 20 },
      average: 80,
      credentials: [
        {
          id: "fixture-cs",
          name: "Computer Science",
          short: "CS",
          kind: "major" as const,
          filled: 1,
          total: 2,
          complete: false,
          groups: [{ id: "free", label: "Elective", need: 1, courses: [], satisfied: false }],
        },
        {
          id: "fixture-stats",
          name: "Statistics Minor",
          short: "Stat",
          kind: "minor" as const,
          filled: 0,
          total: 1,
          complete: false,
          groups: [{ id: "stat230", label: "Probability", need: 1, courses: [], satisfied: false }],
        },
      ],
      problems: [],
      countsFor: {},
      suggestions: [],
      liked: {},
      offering: {},
      coop: { workDone: 0, workTarget: 5, pdDone: 0, pdTarget: 5 },
      warnings: [],
    } satisfies Analysis;
    const profile = {
      id: "fixture",
      name: "Test",
      calendar: "2024-25",
      plan: "H-Test",
      credentials: ["fixture-cs"],
      settings: { counting: "strict" as const },
      overrides: [],
      terms: [{ id: "1271", label: "3A", session: "W27", kind: "study" as const, level: "3A", status: "future" as const, maxCourses: 6 }],
      transcript: [],
    };
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const html = renderToStaticMarkup(
      createElement(
        QueryClientProvider,
        { client },
        createElement(
          PlannerProvider,
          {
            profile,
            initialScenarios: [{ id: "p1", name: "Plan", placements: {} }],
            initialAnalysis: analysis,
            catalogReady: true,
          },
          createElement(RequirementsView),
        ),
      ),
    );
    expect(html).toContain("Stat");
    expect(html).toContain("Elective");
  });
});

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
