"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { usePlanner } from "@/components/PlannerProvider";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { cn } from "@/lib/utils";

export function PlanTabs() {
  const { scenarios, setScenarios, scenarioId, setScenarioId, setBooks } = usePlanner();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function duplicate(fromId: string) {
    const res = await fetch("/api/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fromId }),
    });
    const copy = await res.json();
    setScenarios((prev) => [...prev, copy]);
    setBooks((prev) => ({ ...prev, [copy.id]: copy.placements }));
    setScenarioId(copy.id);
  }

  async function remove(id: string) {
    const res = await fetch("/api/plan", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) return;
    setScenarios((prev) => prev.filter((s) => s.id !== id));
    setBooks((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (scenarioId === id) {
      const next = scenarios.find((s) => s.id !== id);
      if (next) setScenarioId(next.id);
    }
  }

  async function saveRename(id: string) {
    const res = await fetch("/api/plan", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, name: renameValue }),
    });
    const updated = await res.json();
    setScenarios((prev) => prev.map((s) => (s.id === id ? updated : s)));
    setRenaming(null);
  }

  return (
    <div className="flex min-w-0 items-center gap-0.5 border-l border-line pl-3">
      {scenarios.map((plan) =>
        renaming === plan.id ? (
          <input
            key={plan.id}
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => saveRename(plan.id)}
            onKeyDown={(e) => e.key === "Enter" && saveRename(plan.id)}
            className="h-7 w-24 rounded-full border border-brand px-3 text-[13px] outline-none"
          />
        ) : (
          <Menu
            key={plan.id}
            align="left"
            trigger={
              <button
                type="button"
                className={cn(
                  "h-7 max-w-[8rem] truncate rounded-full px-3 text-[13px] transition-colors",
                  plan.id === scenarioId ? "bg-brand-soft font-medium text-brand" : "text-ink-2 hover:bg-white",
                )}
              >
                {plan.name}
              </button>
            }
          >
            <MenuItem onClick={() => setScenarioId(plan.id)}>Use plan</MenuItem>
            <MenuItem onClick={() => duplicate(plan.id)}>Duplicate</MenuItem>
            <MenuItem
              onClick={() => {
                setRenaming(plan.id);
                setRenameValue(plan.name);
              }}
            >
              Rename
            </MenuItem>
            {scenarios.length > 1 && (
              <MenuItem danger onClick={() => remove(plan.id)}>
                Delete
              </MenuItem>
            )}
          </Menu>
        ),
      )}
      <button
        type="button"
        title="Duplicate active plan"
        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3 hover:bg-white hover:text-brand"
        onClick={() => duplicate(scenarioId)}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
