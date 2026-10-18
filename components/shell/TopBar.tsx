"use client";

import { motion } from "framer-motion";
import { GraduationCap, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { spring } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { PlanTabs } from "./PlanTabs";

const nav = [
  { href: "/", label: "Plan" },
  { href: "/audit", label: "Audit" },
  { href: "/compare", label: "Compare" },
];

export function TopBar() {
  const pathname = usePathname();

  return (
    <header className="glass relative z-20 mx-3 mt-3 flex h-12 shrink-0 items-center gap-3 rounded-2xl px-3 text-[13px]">
      <span className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-[#1b2130]">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#2f6bff] via-[#7c4dff] to-[#e8458b] text-white shadow-[0_4px_12px_-4px_rgba(124,77,255,0.7)]">
          <GraduationCap className="h-4 w-4" />
        </span>
        Course Planner
      </span>
      <nav className="ml-2 flex shrink-0 items-center gap-0.5 rounded-full bg-[#eef1f7]/80 p-1">
        {nav.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative rounded-full px-3.5 py-1 font-medium transition-colors",
                active ? "text-[#1b2130]" : "text-ink-2 hover:text-[#1b2130]",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={spring}
                  className="absolute inset-0 rounded-full bg-white shadow-soft"
                />
              )}
              <span className="relative">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <PlanTabs />
      <button
        type="button"
        className="ml-auto flex h-8 w-[240px] shrink-0 items-center gap-2 rounded-full border border-line bg-white/80 px-3 text-ink-3 transition hover:border-[#c9d4ec] hover:text-ink-2"
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
      >
        <Search className="h-3.5 w-3.5" />
        Search any course
        <kbd className="ml-auto rounded bg-[#eef1f7] px-1.5 text-[10.5px] font-medium">⌘K</kbd>
      </button>
    </header>
  );
}
