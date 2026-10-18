"use client";

import { motion, useAnimationControls } from "framer-motion";
import { useEffect, useRef } from "react";

export function ProgressRing({
  value,
  color,
  size = 56,
  stroke = 6,
  children,
}: {
  value: number;
  color: string;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const pulse = useAnimationControls();
  const prev = useRef(clamped);

  useEffect(() => {
    if (prev.current < 1 && clamped >= 1) {
      void pulse.start({ scale: [1, 1.12, 1], transition: { duration: 0.5 } });
    }
    prev.current = clamped;
  }, [clamped, pulse]);

  return (
    <motion.div animate={pulse} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e9ecf3" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - clamped) }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </motion.div>
  );
}
