"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { formatCode } from "@/engine/levels";
import { diffAnalysis } from "@/engine/whatif";
import type { Analysis, BrowseFilters, Profile, Scenario } from "@/engine/types";
import { coversLine } from "@/lib/covers";
import { postAnalysis } from "@/lib/analyze-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Toast } from "./ui/Toast";

const STORAGE_KEY = "uw-planner-scenario";
const UNDO_MAX = 20;

type Books = Record<string, Scenario["placements"]>;
type Pins = NonNullable<Scenario["pins"]>;

export type PlannerSelection =
  | {
      kind: "course";
      code: string;
      termId?: string;
      /** Prospective fills from browse (available courses not yet in the plan). */
      fills?: { short: string; label: string }[];
    }
  | { kind: "requirement"; groupId: string }
  | null;

export type RequirementFocus = { credentialId: string; groupId: string };

/** A requirement group id, or "all" for the whole catalog. */
export type ActiveList = string;

interface ToastState {
  id: number;
  message: string;
  undo?: () => void;
}

interface PlannerContextValue {
  profile: Profile;
  catalogReady: boolean;
  scenarios: Scenario[];
  setScenarios: React.Dispatch<React.SetStateAction<Scenario[]>>;
  books: Books;
  setBooks: (update: (prev: Books) => Books) => void;
  scenarioId: string;
  setScenarioId: (id: string) => void;
  placements: Scenario["placements"];
  pins: Pins;
  pinBooks: Record<string, Pins>;
  /** Pass null to go back to automatic counting for this course. */
  setCoursePins: (code: string, keys: string[] | null) => void;
  analysis: Analysis;
  analysisFetching: boolean;
  /** Credential progress / units for asOfDisplayTermId (committed; no stale flash). */
  asOfAnalysis: Analysis;
  /** Term the as-of stats currently describe (lags focus until fetch settles). */
  asOfDisplayTermId: string;
  /** The upcoming term new courses go to. Follows focusTermId when it is upcoming. */
  targetTermId: string;
  setTargetTermId: (id: string) => void;
  /** The term shown on the stage; may be a completed term. */
  focusTermId: string;
  setFocusTermId: (id: string) => void;
  pickerOpen: boolean;
  openPicker: (opts?: { termId?: string; list?: ActiveList }) => void;
  closePicker: () => void;
  /** Gap panel for a single open requirement (Still open list). */
  requirementFocus: RequirementFocus | null;
  openRequirement: (focus: RequirementFocus) => void;
  closeRequirement: () => void;
  /** @deprecated use targetTermId */
  activeTermId: string;
  setActiveTermId: (id: string) => void;
  selection: PlannerSelection;
  setSelection: (s: PlannerSelection) => void;
  activeList: ActiveList;
  setActiveList: (id: ActiveList) => void;
  listQuery: string;
  setListQuery: (q: string) => void;
  listFilters: BrowseFilters;
  setListFilters: (f: BrowseFilters | ((prev: BrowseFilters) => BrowseFilters)) => void;
  addCourse: (code: string, termId?: string) => void;
  removeCourse: (code: string, termId: string) => void;
  moveCourse: (code: string, fromTermId: string, toTermId: string) => void;
  refetchAnalysis: () => void;
  openRequirementCount: number;
  showToast: (message: string, undo?: () => void) => void;
  undo: () => void;
  canUndo: boolean;
  dragCode: string | null;
  setDragCode: (code: string | null) => void;
  listSearchFocusRef: React.RefObject<HTMLInputElement | null>;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function usePlanner() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner outside PlannerProvider");
  return ctx;
}

export function PlannerProvider({
  profile,
  initialScenarios,
  initialAnalysis,
  catalogReady,
  children,
}: {
  profile: Profile;
  initialScenarios: Scenario[];
  initialAnalysis: Analysis;
  catalogReady: boolean;
  children: ReactNode;
}) {
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [scenarioId, setScenarioIdState] = useState(initialScenarios[0]?.id ?? "plan-a");
  const [books, setBooks] = useState<Books>(() =>
    Object.fromEntries(initialScenarios.map((s) => [s.id, s.placements])),
  );
  const [pinBooks, setPinBooks] = useState<Record<string, Pins>>(() =>
    Object.fromEntries(initialScenarios.map((s) => [s.id, s.pins ?? {}])),
  );
  const defaultTerm =
    profile.terms.find((t) => t.kind === "study" && t.status === "future")?.id ?? profile.terms[0]?.id ?? "";
  const [focusTermId, setFocusTermId] = useState(defaultTerm);
  const upcomingIds = useMemo(
    () => profile.terms.filter((t) => t.kind === "study" && t.status !== "past").map((t) => t.id),
    [profile],
  );
  const studyIds = useMemo(() => profile.terms.filter((t) => t.kind === "study").map((t) => t.id), [profile]);
  const targetTermId = upcomingIds.includes(focusTermId) ? focusTermId : (upcomingIds[0] ?? defaultTerm);
  const setTargetTermId = setFocusTermId;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [requirementFocus, setRequirementFocus] = useState<RequirementFocus | null>(null);
  const [selection, setSelection] = useState<PlannerSelection>(null);
  const [activeList, setActiveList] = useState<ActiveList>(
    () => initialAnalysis.credentials.flatMap((c) => c.groups).find((g) => !g.satisfied)?.id ?? "all",
  );
  const [listQuery, setListQuery] = useState("");
  const [listFilters, setListFilters] = useState<BrowseFilters>({ sort: "fit" });
  const [toast, setToast] = useState<ToastState | null>(null);
  const [dragCode, setDragCode] = useState<string | null>(null);
  const undoStack = useRef<Scenario["placements"][]>([]);
  const listSearchFocusRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && initialScenarios.some((s) => s.id === stored)) setScenarioIdState(stored);
  }, [initialScenarios]);

  const placements = useMemo(() => books[scenarioId] ?? {}, [books, scenarioId]);
  const pins = useMemo(() => pinBooks[scenarioId] ?? {}, [pinBooks, scenarioId]);

  useEffect(() => {
    setPinBooks((prev) => {
      const missing = scenarios.filter((s) => !(s.id in prev));
      if (missing.length === 0) return prev;
      return { ...prev, ...Object.fromEntries(missing.map((s) => [s.id, s.pins ?? {}])) };
    });
  }, [scenarios]);

  const setScenarioId = useCallback((id: string) => {
    setScenarioIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const setPlacements = useCallback(
    (updater: Scenario["placements"] | ((prev: Scenario["placements"]) => Scenario["placements"])) => {
      setBooks((prev) => {
        const current = prev[scenarioId] ?? {};
        const next = typeof updater === "function" ? updater(current) : updater;
        return { ...prev, [scenarioId]: next };
      });
    },
    [scenarioId],
  );

  const analysisQuery = useQuery({
    queryKey: ["analysis", scenarioId, placements, pins, targetTermId],
    queryFn: () => postAnalysis({ placements, pins, activeTermId: targetTermId, suggest: false }),
    initialData: initialAnalysis,
    placeholderData: (prev) => prev ?? initialAnalysis,
  });

  const asOfQuery = useQuery({
    queryKey: ["analysis-asof", scenarioId, placements, pins, focusTermId],
    queryFn: () =>
      postAnalysis({ placements, pins, activeTermId: targetTermId, asOfTermId: focusTermId, suggest: false }),
    staleTime: 60_000,
  });

  // Only paint as-of stats once the fetch for the focused term is ready — never flash the previous term’s counts.
  const [asOfCommit, setAsOfCommit] = useState(() => ({
    termId: defaultTerm,
    analysis: initialAnalysis,
  }));
  useEffect(() => {
    if (asOfQuery.isFetching) return;
    if (!asOfQuery.data) return;
    setAsOfCommit({ termId: focusTermId, analysis: asOfQuery.data });
  }, [focusTermId, asOfQuery.isFetching, asOfQuery.data]);

  const analysis = analysisQuery.data ?? initialAnalysis;
  const asOfAnalysis = asOfCommit.analysis;
  const asOfDisplayTermId = asOfCommit.termId;

  const openGroups = useMemo(
    () =>
      asOfAnalysis.credentials.flatMap((cred) =>
        cred.groups.filter((g) => !g.satisfied).map((g) => ({ id: g.id, label: g.label, credShort: cred.short })),
      ),
    [asOfAnalysis],
  );

  const save = useMutation({
    mutationFn: async (next: Scenario) => {
      await fetch("/api/plan", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
    },
  });

  useEffect(() => {
    const handle = setTimeout(() => {
      const name = scenarios.find((s) => s.id === scenarioId)?.name ?? "Plan";
      save.mutate({ id: scenarioId, name, placements, pins });
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, pins, scenarioId]);

  const watched = useMemo(() => [...new Set(Object.values(placements).flat())].slice(0, 80), [placements]);
  const fetched = useRef(new Set<string>());
  useEffect(() => {
    const fresh = watched.filter((code) => !fetched.current.has(code));
    if (fresh.length === 0) return;
    for (const code of fresh) fetched.current.add(code);
    let cancel = false;
    (async () => {
      await fetch("/api/offerings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codes: fresh }),
      });
      await fetch("/api/ratings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ codes: fresh }),
      });
      if (!cancel) analysisQuery.refetch();
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watched.join("|")]);

  const pushUndo = useCallback(
    (snapshot: Scenario["placements"]) => {
      undoStack.current.push(structuredClone(snapshot));
      if (undoStack.current.length > UNDO_MAX) undoStack.current.shift();
    },
    [],
  );

  const undo = useCallback(() => {
    const prev = undoStack.current.pop();
    if (prev) setPlacements(prev);
  }, [setPlacements]);

  const dismissToast = useCallback(() => setToast(null), []);
  const showToast = useCallback((message: string, undoAction?: () => void) => {
    setToast({ id: Date.now(), message, undo: undoAction });
  }, []);

  const applyWithToast = useCallback(
    (nextPlacements: Scenario["placements"], message: string, onDone?: () => void) => {
      const snapshot = structuredClone(placements);
      pushUndo(snapshot);
      const before = analysis;
      setPlacements(nextPlacements);
      onDone?.();
      void postAnalysis({ placements: nextPlacements, pins, activeTermId: targetTermId, suggest: false }).then((after) => {
        const delta = diffAnalysis(before, after);
        const filled = delta.gains.filter((g) => g.after > g.before);
        let detail = message;
        if (filled.length) {
          detail += ` · ${filled.map((g) => `${g.short} ${g.before}→${g.after}`).join(", ")}`;
        }
        const codeMatch = message.match(/([A-Z]+\s?\d+[A-Z]?)/);
        const codeKey = codeMatch?.[0]?.replace(/\s+/g, "") ?? "";
        const covered = codeKey ? coversLine(after, codeKey) : "";
        if (covered) detail = `${message} · covers ${covered}`;
        showToast(detail, () => {
          undoStack.current.push(snapshot);
          setPlacements(snapshot);
        });
      });
    },
    [analysis, placements, pins, targetTermId, setPlacements, showToast, pushUndo],
  );

  const setCoursePins = useCallback(
    (code: string, keys: string[] | null) => {
      const previous = pinBooks[scenarioId] ?? {};
      const next = { ...previous };
      if (keys) next[code] = keys;
      else delete next[code];
      setPinBooks((prev) => ({ ...prev, [scenarioId]: next }));
      showToast(
        keys ? `${formatCode(code)} now counts where you chose` : `${formatCode(code)} is counted automatically again`,
        () => setPinBooks((prev) => ({ ...prev, [scenarioId]: previous })),
      );
    },
    [pinBooks, scenarioId, showToast],
  );

  const addCourse = useCallback(
    (code: string, termId?: string) => {
      const to = termId ?? targetTermId;
      if (profile.transcript.some((t) => t.code === code)) return;
      const next: Record<string, string[]> = {};
      for (const [term, codes] of Object.entries(placements)) next[term] = codes.filter((c) => c !== code);
      next[to] = [...(next[to] ?? []).filter((c) => c !== code), code];
      applyWithToast(
        next,
        `Added ${formatCode(code)} to ${profile.terms.find((t) => t.id === to)?.label ?? "term"}`,
        () => setFocusTermId(to),
      );
    },
    [targetTermId, profile, placements, applyWithToast],
  );

  const removeCourse = useCallback(
    (code: string, termId: string) => {
      applyWithToast(
        { ...placements, [termId]: (placements[termId] ?? []).filter((c) => c !== code) },
        `Removed ${formatCode(code)}`,
      );
    },
    [placements, applyWithToast],
  );

  const moveCourse = useCallback(
    (code: string, fromTermId: string, toTermId: string) => {
      if (fromTermId === toTermId) return;
      const next: Record<string, string[]> = {};
      for (const [term, codes] of Object.entries(placements)) next[term] = codes.filter((c) => c !== code);
      if (!profile.transcript.some((t) => t.code === code)) {
        next[toTermId] = [...(next[toTermId] ?? []).filter((c) => c !== code), code];
      }
      const label = profile.terms.find((t) => t.id === toTermId)?.label ?? "term";
      applyWithToast(next, `Moved ${formatCode(code)} to ${label}`);
    },
    [profile, placements, applyWithToast],
  );

  const openPicker = useCallback(
    (opts?: { termId?: string; list?: ActiveList }) => {
      if (opts?.termId) setFocusTermId(opts.termId);
      if (opts?.list) {
        setActiveList(opts.list);
      } else {
        const firstGap = analysis.credentials
          .flatMap((c) => c.groups)
          .find((g) => !g.satisfied);
        setActiveList(firstGap?.id ?? "all");
      }
      setListQuery("");
      setRequirementFocus(null);
      setPickerOpen(true);
      setTimeout(() => listSearchFocusRef.current?.focus(), 250);
    },
    [analysis],
  );
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const openRequirement = useCallback((focus: RequirementFocus) => {
    setPickerOpen(false);
    setRequirementFocus(focus);
  }, []);
  const closeRequirement = useCallback(() => setRequirementFocus(null), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (mod && e.key === "z") {
        if (typing) return;
        e.preventDefault();
        undo();
        return;
      }
      if (e.key === "Escape") {
        if (requirementFocus) setRequirementFocus(null);
        else if (pickerOpen) setPickerOpen(false);
        else setSelection(null);
        return;
      }
      if (
        !pickerOpen &&
        !requirementFocus &&
        !typing &&
        !mod &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        const i = studyIds.indexOf(focusTermId);
        const next = studyIds[i + (e.key === "ArrowRight" ? 1 : -1)];
        if (next) {
          e.preventDefault();
          setFocusTermId(next);
        }
        return;
      }
      if (!pickerOpen && !requirementFocus && !typing && !mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        openPicker();
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection?.kind === "course" && selection.termId) {
          const tag = (e.target as HTMLElement)?.tagName;
          if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
          e.preventDefault();
          removeCourse(selection.code, selection.termId);
          setSelection(null);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, undo, removeCourse, pickerOpen, requirementFocus, studyIds, focusTermId, openPicker]);

  const value: PlannerContextValue = {
    profile,
    catalogReady,
    scenarios,
    setScenarios,
    books,
    setBooks,
    scenarioId,
    setScenarioId,
    placements,
    pins,
    pinBooks,
    setCoursePins,
    analysis,
    analysisFetching: analysisQuery.isFetching || asOfQuery.isFetching,
    asOfAnalysis,
    asOfDisplayTermId,
    targetTermId,
    setTargetTermId,
    focusTermId,
    setFocusTermId,
    pickerOpen,
    openPicker,
    closePicker,
    requirementFocus,
    openRequirement,
    closeRequirement,
    activeTermId: targetTermId,
    setActiveTermId: setTargetTermId,
    selection,
    setSelection,
    activeList,
    setActiveList,
    listQuery,
    setListQuery,
    listFilters,
    setListFilters,
    addCourse,
    removeCourse,
    moveCourse,
    refetchAnalysis: () => analysisQuery.refetch(),
    openRequirementCount: openGroups.length,
    showToast,
    undo,
    canUndo: undoStack.current.length > 0,
    dragCode,
    setDragCode,
    listSearchFocusRef,
  };

  return (
    <PlannerContext.Provider value={value}>
      {children}
      <Toast toast={toast} onDismiss={dismissToast} />
    </PlannerContext.Provider>
  );
}
