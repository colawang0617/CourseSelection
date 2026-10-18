import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import path from "path";
import { credentialsFor } from "@/data/credentials";
import { LISTS } from "@/data/lists";
import { analyze, suggestedPlacements } from "@/engine/analyze";
import type {
  Analysis,
  CatalogList,
  CourseRecord,
  OfferingBook,
  Profile,
  RatingInfo,
  Scenario,
} from "@/engine/types";
import type { InvalidRow } from "@/engine/policies";

const root = process.cwd();

function readJson<T>(file: string, fallback: T): T {
  const full = path.join(root, file);
  if (!existsSync(full)) return fallback;
  return JSON.parse(readFileSync(full, "utf8")) as T;
}

export function loadProfile(id = "me"): Profile {
  return readJson<Profile>(`data/profiles/${id}.json`, null as unknown as Profile);
}

export function loadLists(): Record<string, CatalogList> {
  const generated = readJson<Record<string, CatalogList>>("data/catalog/lists.json", {});
  const merged: Record<string, CatalogList> = { ...LISTS };
  for (const [id, list] of Object.entries(generated)) {
    if ((list.codes?.length ?? 0) > 0 || (list.subjects?.length ?? 0) > 0) merged[id] = list;
  }
  return merged;
}

export function loadInvalid(): InvalidRow[] {
  return readJson<InvalidRow[]>("data/catalog/invalid-combos.json", []);
}

let catalogCache: { at: number; catalogs: { since: string; courses: Record<string, CourseRecord> }[] } | null =
  null;

export function loadCatalogs() {
  const stamp = Date.now();
  if (catalogCache && stamp - catalogCache.at < 60_000) return catalogCache.catalogs;
  const read = (file: string) => {
    const full = path.join(root, "data/catalog", file);
    if (!existsSync(full)) return {} as Record<string, CourseRecord>;
    const rows = JSON.parse(readFileSync(full, "utf8")) as CourseRecord[];
    return Object.fromEntries(rows.map((row) => [row.code, row]));
  };
  const catalogs = [
    { since: "0000", courses: read("courses-2024-25.json") },
    { since: "1269", courses: read("courses-2026-27.json") },
  ].filter((cat) => Object.keys(cat.courses).length > 0);
  catalogCache = { at: stamp, catalogs };
  return catalogs;
}

export function catalogSize() {
  return loadCatalogs().reduce((sum, cat) => sum + Object.keys(cat.courses).length, 0);
}

export function loadOfferings(): OfferingBook {
  return readJson<OfferingBook>("data/cache/offerings.json", { postedTerms: [], courses: {} });
}

export function saveOfferings(book: OfferingBook) {
  mkdirSync(path.join(root, "data/cache"), { recursive: true });
  writeFileSync(path.join(root, "data/cache/offerings.json"), JSON.stringify(book));
}

export function loadRatings(): Record<string, RatingInfo & { at: number; seasons: string[] }> {
  return readJson("data/cache/ratings.json", {});
}

export function saveRatings(ratings: Record<string, RatingInfo & { at: number; seasons: string[] }>) {
  mkdirSync(path.join(root, "data/cache"), { recursive: true });
  writeFileSync(path.join(root, "data/cache/ratings.json"), JSON.stringify(ratings));
}

export function listScenarios(): Scenario[] {
  const dir = path.join(root, "data/plans");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as Scenario)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function saveScenario(scenario: Scenario) {
  mkdirSync(path.join(root, "data/plans"), { recursive: true });
  writeFileSync(path.join(root, "data/plans", `${scenario.id}.json`), JSON.stringify(scenario, null, 2));
}

export function deleteScenario(id: string) {
  const file = path.join(root, "data/plans", `${id}.json`);
  if (existsSync(file)) unlinkSync(file);
}

export function ensureScenario(profile: Profile): Scenario[] {
  const existing = listScenarios();
  if (existing.length) return existing;
  const creds = credentialsFor(profile.credentials);
  const scenario: Scenario = {
    id: "plan-a",
    name: "Plan A",
    placements: suggestedPlacements(profile, creds),
  };
  saveScenario(scenario);
  return [scenario];
}

export async function runAnalysis(opts: {
  profile: Profile;
  placements: Record<string, string[]>;
  activeTermId?: string;
  asOfTermId?: string;
  query?: string;
  filterGroupId?: string;
  suggest?: boolean;
  pins?: Record<string, string[]>;
}): Promise<Analysis> {
  const ratings = loadRatings();
  const liked: Record<string, { liked: number | null }> = {};
  for (const [code, info] of Object.entries(ratings)) liked[code] = { liked: info.liked };
  return analyze({
    profile: opts.profile,
    credentials: credentialsFor(opts.profile.credentials),
    placements: opts.placements,
    lists: loadLists(),
    catalogs: loadCatalogs(),
    offerings: loadOfferings(),
    ratings: liked,
    invalidRows: loadInvalid(),
    activeTermId: opts.activeTermId,
    asOfTermId: opts.asOfTermId,
    query: opts.query,
    filterGroupId: opts.filterGroupId,
    suggest: opts.suggest,
    pins: opts.pins,
  });
}
