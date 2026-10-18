export type Requisite =
  | { op: "and"; items: Requisite[] }
  | { op: "or"; n: number; items: Requisite[] }
  | {
      op: "course";
      code: string;
      minGrade?: number;
      when: "prior" | "prior-or-same";
    }
  | { op: "level"; min: string }
  | { op: "plan"; plans: string[] }
  | { op: "average"; min: number }
  | { op: "unparsed"; text: string }
  | { op: "true" };

export type Antirequisite =
  | { op: "and"; items: Antirequisite[] }
  | { op: "notWith"; codes: string[]; concurrent: boolean }
  | { op: "unparsed"; text: string }
  | { op: "true" };

export interface CourseRecord {
  code: string;
  title: string;
  credits: number;
  subject: string;
  description: string;
  crossList: string[];
  prerequisites: Requisite | null;
  corequisites: Requisite | null;
  antirequisites: Antirequisite | null;
  prereqText: string;
  coreqText: string;
  antireqText: string;
}

export interface SlotGroup {
  id: string;
  label: string;
  need: number;
  weight: number;
  overlap?: boolean;
  codes?: string[];
  listRef?: string;
  listRefs?: string[];
  subjects?: string[];
  exclude?: string[];
  excludeSubjects?: string[];
  /** When set, only courses with this credit value qualify. */
  credits?: number;
  anyHalf?: boolean;
  minGrade?: number;
  /** Course must be taken in this level or later. */
  notBeforeLevel?: string;
  facultyMin?: { label: string; n: number; codes: string[] }[];
  maxFrom?: { n: number; codes: string[] }[];
}

/**
 * Calendar-facing presentation tree. References flat `groups` by id;
 * does not change allocation.
 */
export interface HierarchyNodeDef {
  id: string;
  label: string;
  note?: string;
  /** Leaf groups under this node (needs sum for progress). */
  groupIds?: string[];
  children?: HierarchyNodeDef[];
  /** Workspace Still open section heading. */
  stillOpenSection?: string;
}

export interface CredentialDef {
  id: string;
  name: string;
  short: string;
  kind: "major" | "minor" | "specialization" | "option";
  calendar: string;
  /** Degree unit target. Set on the major only. */
  units?: number;
  /**
   * Courses named by both this credential and its major.
   * Using the course for both counts as one use.
   */
  sharedWithMajor?: string[];
  /** level label -> course codes to drop into an empty plan */
  suggestedLevel?: Record<string, string[]>;
  groups: SlotGroup[];
  /** Optional calendar hierarchy for audit / Still open grouping. */
  hierarchy?: HierarchyNodeDef[];
}

/** Rolled-up hierarchy node for UI (from HierarchyNodeDef + GroupViews). */
export interface HierarchyView {
  id: string;
  label: string;
  note?: string;
  need: number;
  filled: number;
  satisfied: boolean;
  courses: string[];
  /** All leaf group ids under this node. */
  groupIds: string[];
  children?: HierarchyView[];
  /** Set when this node is exactly one leaf group (for openRequirement). */
  leafGroupId?: string;
  stillOpenSection?: string;
}

export interface CatalogList {
  id: string;
  codes?: string[];
  subjects?: string[];
  exclude?: string[];
}

export interface TermDef {
  id: string;
  label: string;
  session: string;
  kind: "study" | "work";
  level: string;
  status: "past" | "current" | "future";
  maxCourses?: number;
}

export interface TranscriptItem {
  code: string;
  term: string;
  grade?: number | null;
  credits: number;
  status: "complete" | "in-progress";
  title?: string;
}

export interface Override {
  code: string;
  waiveNotBefore?: boolean;
  ignorePrereq?: boolean;
}

export interface Profile {
  id: string;
  name: string;
  calendar: string;
  plan: string;
  credentials: string[];
  settings: { counting: "strict" | "relaxed" };
  overrides: Override[];
  terms: TermDef[];
  transcript: TranscriptItem[];
}

export interface Scenario {
  id: string;
  name: string;
  placements: Record<string, string[]>;
  /** course code -> "credentialId:groupId" keys the student chose to count it toward. */
  pins?: Record<string, string[]>;
}

export interface OfferingBook {
  postedTerms: string[];
  /** code -> termId -> offered */
  courses: Record<string, Record<string, boolean>>;
}

export interface RatingInfo {
  liked: number | null;
  easy: number | null;
  useful: number | null;
  filled: number;
  comments: { text: string; liked: number | null; createdAt: string }[];
}

export interface Problem {
  code: string;
  termId: string;
  severity: "error" | "warn" | "info";
  message: string;
}

export interface GroupView {
  id: string;
  label: string;
  need: number;
  courses: string[];
  satisfied: boolean;
  note?: string;
}

export interface CredentialView {
  id: string;
  name: string;
  short: string;
  kind: CredentialDef["kind"];
  filled: number;
  total: number;
  complete: boolean;
  groups: GroupView[];
}

export type CoursePlanStatus =
  | { kind: "available" }
  | { kind: "taken"; termId: string; termLabel: string; grade?: number | null }
  | { kind: "planned"; termId: string; termLabel: string };

export interface BrowseRow {
  code: string;
  title: string;
  credits: number;
  offering: "offered" | "absent" | "unknown";
  offeringByTerm: Record<string, "offered" | "absent" | "unknown">;
  blocked: string | null;
  liked: number | null;
  gain: number;
  fills: { short: string; label: string }[];
  status: CoursePlanStatus;
}

export interface BrowseFilters {
  offeredOnly?: boolean;
  prereqsMet?: boolean;
  hideTakenPlanned?: boolean;
  subject?: string;
  levelMin?: number;
  levelMax?: number;
  sort?: "fit" | "code" | "liked";
}

export interface Suggestion {
  code: string;
  title: string;
  gain: number;
  offering: "offered" | "absent" | "unknown";
  liked: number | null;
  blocked: string | null;
  groups: string[];
  /** Requirements this course would newly cover, with the credential's short name. */
  fills: { short: string; label: string }[];
}

export interface RequiredCourse {
  code: string;
  credentialId: string;
  /**
   * sequence: calendar places it in a specific term.
   * core: named required course, any term.
   * choice: required elective (must fill the slot; pick from a short list), e.g. User interfaces, Mechanics.
   */
  kind: "sequence" | "core" | "choice";
  label: string;
  level?: string;
  termId?: string;
}

export interface Analysis {
  units: { earned: number; projected: number; target: number | null };
  average: number;
  credentials: CredentialView[];
  problems: Problem[];
  /** course code -> credential ids it was counted toward */
  countsFor: Record<string, { credentialId: string; groupId: string; label: string }[]>;
  suggestions: Suggestion[];
  /** Known UWFlow liked scores, keyed by course code. */
  liked: Record<string, number>;
  /** Course code -> calendar title, for every course on the transcript or in the plan. */
  titles?: Record<string, string>;
  /** Course code -> every requirement it could count toward, in credential order. */
  eligibleFor?: Record<string, { credentialId: string; groupId: string; label: string; overlap?: boolean }[]>;
  /** Course code -> term id, for every course on the transcript or in the plan. */
  termOf?: Record<string, string>;
  /** Degree-calendar required courses and required electives. Sequence > core > choice. */
  required?: RequiredCourse[];
  /** Planned course -> whether its term currently lists it. */
  offering: Record<string, "offered" | "absent" | "unknown">;
  coop: { workDone: number; workTarget: number; pdDone: number; pdTarget: number };
  warnings: string[];
}
