"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Undo2, X } from "lucide-react";
import { useEffect } from "react";
import { spring } from "@/lib/theme";

export function Toast({
  toast,
  onDismiss,
}: {
  toast: { id: number; message: string; undo?: () => void } | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  return (
    <div className="pointer-events-none fixed bottom-12 left-1/2 z-50 -translate-x-1/2">
      <AnimatePresence mode="popLayout">
        {toast && (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={spring}
            className="pointer-events-auto flex max-w-lg items-center gap-3 rounded-full bg-[#1b2130]/95 py-2 pl-5 pr-2 text-[13px] text-white shadow-[0_16px_40px_-12px_rgba(27,33,48,0.6)] backdrop-blur"
          >
            <span className="flex-1">{toast.message}</span>
            {toast.undo && (
              <button
                type="button"
                onClick={toast.undo}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium transition hover:bg-white/20"
              >
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </button>
            )}
            <button
              type="button"
              className="rounded-full p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
              onClick={onDismiss}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
