"use client";

import { cn } from "@/lib/utils";

export function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[#e6e6ea] pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm",
            active === tab.id ? "bg-[#1d1d1f] text-white" : "text-[#6e6e73] hover:bg-[#f5f5f7]",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
