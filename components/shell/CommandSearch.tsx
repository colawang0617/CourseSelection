"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatCode } from "@/engine/levels";

export function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[15vh]">
      <div className="w-full max-w-md rounded-2xl border border-[#e6e6ea] bg-white p-3 shadow-xl">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search course code…"
          className="w-full rounded-lg bg-[#f5f5f7] px-3 py-2 text-sm outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) {
              const code = q.trim().replace(/\s+/g, "").toUpperCase();
              setOpen(false);
              setQ("");
              router.push(`/courses/${encodeURIComponent(code)}`);
            }
          }}
        />
        <p className="mt-2 px-1 text-xs text-[#6e6e73]">Press Enter to open {q ? formatCode(q.replace(/\s+/g, "")) : "course"}</p>
        <button type="button" className="mt-2 text-sm text-[#0071e3]" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </div>
  );
}
