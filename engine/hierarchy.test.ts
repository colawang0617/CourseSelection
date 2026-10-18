import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { credentialsFor } from "@/data/credentials";
import { seMajorHierarchy } from "@/data/credentials/se-major-2024";
import { analyze } from "./analyze";
import { findHierarchyNode, rollupHierarchy, stillOpenSections } from "./hierarchy";
import type { Profile } from "./types";

const profile = JSON.parse(
  readFileSync(new URL("../data/profiles/me.json", import.meta.url), "utf8"),
) as Profile;
const creds = credentialsFor(profile.credentials);
const major = creds.find((c) => c.id === "se-major-2024")!;

describe("calendar hierarchy rollup", () => {
  it("rolls NS to 4 and approved electives to 12", () => {
    const tree = rollupHierarchy(seMajorHierarchy, [
      { id: "ns-1", label: "Mechanics", need: 1, courses: ["PHYS121"], satisfied: true },
      { id: "ns-rest", label: "Natural science", need: 3, courses: ["EARTH270", "PSYCH207"], satisfied: false },
      { id: "te-1", label: "TE1", need: 1, courses: [], satisfied: false },
      { id: "te-2", label: "TE2", need: 1, courses: [], satisfied: false },
      { id: "te-flex", label: "TEflex", need: 1, courses: [], satisfied: false },
      { id: "cse-a", label: "A", need: 1, courses: [], satisfied: false },
      { id: "cse-c", label: "C", need: 1, courses: [], satisfied: false },
      { id: "comm", label: "Comm", need: 1, courses: ["ENGL109"], satisfied: true },
      { id: "free", label: "Free", need: 2, courses: ["CO250"], satisfied: false },
      { id: "cs137", label: "Programming", need: 1, courses: ["CS137"], satisfied: true },
      { id: "sustainability", label: "Sustainability", need: 1, courses: [], satisfied: false },
    ]);

    const ns = findHierarchyNode(tree, "ns")!;
    expect(ns.need).toBe(4);
    expect(ns.filled).toBe(3);
    expect(ns.satisfied).toBe(false);
    expect(ns.courses.sort()).toEqual(["EARTH270", "PHYS121", "PSYCH207"]);

    const electives = findHierarchyNode(tree, "electives")!;
    expect(electives.need).toBe(12);
    expect(electives.filled).toBe(5); // ns 3 + comm 1 + free 1

    const comm = findHierarchyNode(tree, "comm-leaf")!;
    expect(comm.courses).toEqual(["ENGL109"]);
    expect(comm.leafGroupId).toBe("comm");
  });

  it("places ENGL109 under Communication from a real analysis", async () => {
    const result = await analyze({ profile, credentials: creds, placements: {}, suggest: false });
    const majorView = result.credentials.find((c) => c.id === "se-major-2024")!;
    const tree = rollupHierarchy(major.hierarchy!, majorView.groups);
    const comm = findHierarchyNode(tree, "comm-leaf")!;
    expect(comm.courses).toContain("ENGL109");
    expect(findHierarchyNode(tree, "electives")!.need).toBe(12);
    expect(findHierarchyNode(tree, "ns")!.need).toBe(4);
  });

  it("nests required courses under calendar terms", async () => {
    const result = await analyze({ profile, credentials: creds, placements: {}, suggest: false });
    const majorView = result.credentials.find((c) => c.id === "se-major-2024")!;
    const tree = rollupHierarchy(major.hierarchy!, majorView.groups);
    const required = findHierarchyNode(tree, "required")!;
    expect(required.children?.map((c) => c.label)).toEqual([
      "1A",
      "1B",
      "2A",
      "2B",
      "3A",
      "3B",
      "4A",
      "4B",
    ]);
    const term1A = findHierarchyNode(tree, "req-1a")!;
    expect(term1A.groupIds).toContain("cs137");
    expect(term1A.courses).toContain("CS137");
    expect(term1A.need).toBe(6);
    expect(required.need).toBe(32);
  });

  it("groups still-open leaves under calendar section headings", async () => {
    const result = await analyze({ profile, credentials: creds, placements: {}, suggest: false });
    const majorView = result.credentials.find((c) => c.id === "se-major-2024")!;
    const sections = stillOpenSections(majorView, major.hierarchy);
    const labels = sections.map((s) => s.section);
    expect(labels).toContain("Natural science");
    expect(labels).toContain("Technical electives");
    const ns = sections.find((s) => s.section === "Natural science")!;
    expect(ns.groups.some((g) => g.id === "ns-rest")).toBe(true);
  });
});
