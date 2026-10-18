import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { credentialsFor } from "@/data/credentials";
import { allocate } from "./allocate";
import { analyze } from "./analyze";
import { comboWarnings } from "./policies";
import { parseAntirequisite, parseRequisite, checkRequisite } from "./prereq";
import type { CourseRecord, CredentialDef, Profile } from "./types";

const profile = JSON.parse(
  readFileSync(new URL("../data/profiles/me.json", import.meta.url), "utf8"),
) as Profile;
const creds = credentialsFor(profile.credentials);

const req = (
  partial: Partial<CourseRecord> & { code: string },
): Partial<CourseRecord> => partial;

describe("requisite parser", () => {
  it("reads level, plan, and course choices", () => {
    const html = `
      <ul><li>Complete all of the following
        <ul>
          <li>Must have completed at least 1 of the following:
            <ul><li><a>CS240</a></li><li><a>CS240E</a></li></ul>
          </li>
          <li>Students must be in level 3B or higher</li>
          <li>Enrolled in <a>H-Software Engineering</a> or <a>H-Computer Science (BCS)</a></li>
        </ul>
      </li></ul>`;
    const tree = parseRequisite(html);
    expect(tree?.op).toBe("and");
    const ctx = {
      before: new Map([["CS240", { grade: 80 }]]),
      sameTerm: new Set<string>(),
      level: "3A",
      plan: "H-Software Engineering",
      average: 85,
    };
    const failed = checkRequisite(tree, ctx);
    expect(failed.ok).toBe(false);
    expect(failed.reasons.join(" ")).toMatch(/3B/);
    const passed = checkRequisite(tree, { ...ctx, level: "4A" });
    expect(passed.ok).toBe(true);
  });

  it("parses an antirequisite", () => {
    const html = `<ul><li>Not completed nor concurrently enrolled in any of the following:
      <ul><li><a>MSE343</a></li></ul></li></ul>`;
    const tree = parseAntirequisite(html);
    expect(tree?.op).toBe("notWith");
  });
});

describe("transcript audit", () => {
  it("matches the 2B audit", async () => {
    const result = await analyze({ profile, credentials: creds, placements: {}, suggest: false });
    expect(result.units.earned).toBe(12);
    expect(result.units.target).toBe(21.5);
    const major = result.credentials.find((c) => c.id === "se-major-2024")!;
    const group = (id: string) => major.groups.find((g) => g.id === id)!;
    expect(group("te-flex").courses).toEqual(["CO351"]);
    expect(group("te-1").satisfied).toBe(false);
    expect(group("te-2").satisfied).toBe(false);
    expect(group("free").courses).toEqual(["CO250"]);
    expect(group("ns-1").courses).toEqual(["PHYS121"]);
    expect(group("ns-rest").courses.slice().sort()).toEqual(["EARTH270", "PSYCH207"]);
    expect(group("comm").courses).toEqual(["ENGL109"]);
    expect(group("sustainability").satisfied).toBe(true);
    expect(group("cse-a").satisfied).toBe(false);
    expect(group("cse-c").satisfied).toBe(false);
    const electiveNeed = ["comm", "ns-1", "ns-rest", "te-1", "te-2", "te-flex", "cse-a", "cse-c", "free"]
      .reduce((s, id) => s + group(id).need, 0);
    expect(electiveNeed).toBe(12);

    const co = result.credentials.find((c) => c.id === "co-minor")!;
    expect(co.groups.find((g) => g.id === "upper")!.courses).toEqual(["CO351"]);
    expect(co.groups.find((g) => g.id === "intro")!.satisfied).toBe(true);
    expect(co.groups.find((g) => g.id === "linalg")!.satisfied).toBe(true);

    const hci = result.credentials.find((c) => c.id === "se-hci")!;
    expect(hci.groups.find((g) => g.id === "design")!.courses).toEqual(["PSYCH207"]);
    expect(hci.groups.find((g) => g.id === "cs449")!.satisfied).toBe(false);
    expect(hci.groups.find((g) => g.id === "society")!.satisfied).toBe(false);
  });
});

const rules: Record<string, Partial<CourseRecord>> = {
  CS449: req({
    code: "CS449",
    title: "Human-Computer Interaction",
    prerequisites: {
      op: "and",
      items: [
        { op: "course", code: "CS240", when: "prior" },
        { op: "course", code: "CS241", when: "prior" },
        { op: "level", min: "3B" },
        { op: "plan", plans: ["H-Software Engineering"] },
      ],
    },
    antirequisites: { op: "notWith", codes: ["MSE343"], concurrent: true },
  }),
  MSE343: req({
    code: "MSE343",
    title: "Human-Computer Interaction",
    antirequisites: { op: "notWith", codes: ["CS449"], concurrent: true },
  }),
  CS486: req({
    code: "CS486",
    title: "Introduction to Artificial Intelligence",
    prerequisites: {
      op: "and",
      items: [
        { op: "course", code: "CS341", when: "prior" },
        { op: "plan", plans: ["H-Software Engineering"] },
      ],
    },
  }),
  CS480: req({
    code: "CS480",
    prerequisites: {
      op: "and",
      items: [
        { op: "course", code: "CS341", when: "prior" },
        { op: "course", code: "STAT206", when: "prior" },
      ],
    },
  }),
  CS492: req({
    code: "CS492",
    prerequisites: {
      op: "and",
      items: [
        { op: "course", code: "CS240", when: "prior" },
        { op: "plan", plans: ["H-Software Engineering"] },
      ],
    },
  }),
  ECE457C: req({
    code: "ECE457C",
    prerequisites: { op: "course", code: "STAT206", when: "prior" },
  }),
  CO367: req({
    code: "CO367",
    prerequisites: { op: "course", code: "MATH138", when: "prior" },
  }),
  CO456: req({
    code: "CO456",
    prerequisites: {
      op: "and",
      items: [
        { op: "course", code: "CO250", when: "prior" },
        { op: "course", code: "MATH239", when: "prior" },
      ],
    },
  }),
  PSYCH261: req({ code: "PSYCH261", prerequisites: { op: "level", min: "1B" } }),
  STV208: req({ code: "STV208", title: "AI and Society" }),
  CS349: req({ code: "CS349", title: "User Interfaces" }),
};

describe("planned courses", () => {
  it("flags level, antirequisite, prerequisite order, and a missing offering", async () => {
    const early = await analyze({
      profile,
      credentials: creds,
      placements: { "1271": ["CS449", "MSE343", "CS486"], "1279": ["CS341"] },
      courses: rules,
      offerings: { postedTerms: ["1271"], courses: { CO456: { "1271": false } } },
      suggest: false,
    });
    const messages = (code: string) =>
      early.problems.filter((p) => p.code === code).map((p) => p.message);
    expect(messages("CS449").join(" ")).toMatch(/3B/);
    expect(messages("CS449").join(" ") + messages("MSE343").join(" ")).toMatch(/Conflicts/);
    expect(messages("CS486").join(" ")).toMatch(/CS 341/);

    const missing = await analyze({
      profile,
      credentials: creds,
      placements: { "1271": ["CO456"] },
      courses: rules,
      offerings: { postedTerms: ["1271"], courses: { CO456: { "1271": false } } },
      suggest: false,
    });
    expect(missing.problems.some((p) => p.code === "CO456" && p.message === "Not offered")).toBe(
      true,
    );
  });

  it("completes every credential on the sample plan at 6/6/5/5", async () => {
    const placements = {
      "1271": ["CS341", "MATH213", "SE350", "SE465", "CS349", "ECE457C"],
      "1279": ["CS343", "ECE358", "SE380", "SE390", "SE464", "CO367"],
      "1285": ["SE463", "SE490", "CS449", "CS492", "PSYCH261"],
      "1291": ["SE491", "CS486", "CS480", "CO456", "STV208"],
    };
    const result = await analyze({
      profile,
      credentials: creds,
      placements,
      courses: rules,
      suggest: false,
    });
    const errors = result.problems.filter((p) => p.severity === "error");
    expect(errors).toEqual([]);
    for (const cred of result.credentials) {
      expect(cred.complete, cred.name).toBe(true);
    }
    expect(placements["1271"]).toHaveLength(6);
    expect(placements["1279"]).toHaveLength(6);
    expect(placements["1285"]).toHaveLength(5);
    expect(placements["1291"]).toHaveLength(5);
  });
});

describe("invalid combinations", () => {
  it("leaves the declared plans alone and still flags a real clash", () => {
    const rows = JSON.parse(
      readFileSync(new URL("../data/catalog/invalid-combos.json", import.meta.url), "utf8"),
    ) as { plan: string; cannot: string }[];
    expect(comboWarnings(creds, rows)).toEqual([]);
    const csMinor = {
      ...creds[0],
      id: "cs-minor",
      name: "Computer Science",
      short: "CS",
      kind: "minor" as const,
    };
    expect(comboWarnings([creds[0], csMinor], rows)).toContain("Degree can't be combined with CS");
  });
});

describe("allocation priority", () => {
  const credential = (id: string, kind: CredentialDef["kind"], weight: number): CredentialDef => ({
    id,
    name: id,
    short: id,
    kind,
    calendar: "2024-25",
    groups: [{ id: `${id}-g`, label: `${id} group`, need: 1, weight, codes: ["CS486"] }],
  });
  const credentials = [credential("major", "major", 10), credential("spec", "specialization", 90), credential("minor", "minor", 90)];
  const course = { code: "CS486", subject: "CS", credits: 0.5, status: "planned" as const, level: "4A" };

  it("fills the major before options and minors", async () => {
    const chosen = await allocate({ courses: [course], credentials, lists: {}, counting: "strict" });
    const ids = chosen.map((a) => a.credentialId).sort();
    expect(ids).toHaveLength(2);
    expect(ids).toContain("major");
  });

  it("follows the student's choice over the default", async () => {
    const chosen = await allocate({
      courses: [course],
      credentials,
      lists: {},
      counting: "strict",
      pins: { CS486: ["spec:spec-g", "minor:minor-g"] },
    });
    expect(chosen.map((a) => a.credentialId).sort()).toEqual(["minor", "spec"]);
  });
});

describe("as-of term progress", () => {
  const done = (a: Awaited<ReturnType<typeof analyze>>) =>
    a.credentials.find((c) => c.id === "se-major-2024")!.groups.filter((g) => g.satisfied).length;

  it("credits later fixed required, but electives only through the focus term", async () => {
    const placements = {
      "1271": ["CS341", "MATH213", "SE350", "SE465", "CS349", "ECE457C"],
      "1291": ["CS486"],
    };
    const through3A = await analyze({
      profile,
      credentials: creds,
      placements,
      asOfTermId: "1271",
      suggest: false,
    });
    // Fixed calendar sequence after 3A still counts.
    expect(through3A.countsFor["SE463"]).toBeDefined();
    expect(through3A.countsFor["SE491"]).toBeDefined();
    // Elective in 3A counts; open elective after 3A does not.
    expect(through3A.countsFor["CS349"]).toBeDefined();
    expect(through3A.countsFor["CS486"]).toBeUndefined();
  });

  it("lets electives taken in 1B change the count vs 1A", async () => {
    const term1A = profile.terms.find((t) => t.level === "1A" && t.kind === "study")!.id;
    const term1B = profile.terms.find((t) => t.level === "1B" && t.kind === "study")!.id;
    const through1A = await analyze({
      profile,
      credentials: creds,
      placements: {},
      asOfTermId: term1A,
      suggest: false,
    });
    const through1B = await analyze({
      profile,
      credentials: creds,
      placements: {},
      asOfTermId: term1B,
      suggest: false,
    });
    // 1B elective (e.g. ENGL109 / PSYCH207) is after 1A, so it must not count at 1A.
    expect(through1A.countsFor["ENGL109"]).toBeUndefined();
    expect(through1A.countsFor["PSYCH207"]).toBeUndefined();
    expect(through1B.countsFor["ENGL109"]).toBeDefined();
    expect(through1B.countsFor["PSYCH207"]).toBeDefined();
    // Fixed cores after 1A still count in both (e.g. CS138 in 1B).
    expect(through1A.countsFor["CS138"]).toBeDefined();
    expect(done(through1A)).toBeLessThan(done(through1B));
  });
});

describe("required courses", () => {
  it("marks named cores, required electives, and not open electives", async () => {
    const result = await analyze({
      profile,
      credentials: creds,
      placements: { "1271": ["CS349", "CS486", "CS492"] },
      suggest: false,
    });
    const byCode = new Map((result.required ?? []).map((r) => [r.code, r]));
    const se465 = byCode.get("SE465");
    expect(se465?.kind).toBe("sequence");
    expect(se465?.level).toBe("3A");
    expect(se465?.termId).toBe(profile.terms.find((t) => t.level === "3A" && t.kind === "study")?.id);
    expect(byCode.get("CS137")?.kind).toBe("core");
    expect(byCode.get("MATH115")?.kind).toBe("core");
    // Required electives: must fill the slot, choose from a short list.
    expect(byCode.get("PHYS121")?.kind).toBe("choice");
    expect(byCode.get("PHYS121")?.label).toMatch(/Mechanics|Natural science/i);
    expect(byCode.get("CS349")?.kind).toBe("choice");
    expect(byCode.get("CS349")?.label).toMatch(/User interfaces/i);
    // Open electives / specialization-only picks are not tagged Required.
    expect(byCode.has("CS486")).toBe(false);
    expect(byCode.has("CS492")).toBe(false);
  });
});
