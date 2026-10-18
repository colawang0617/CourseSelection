import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "secondary";
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-[#0071e3] text-white hover:bg-[#0077ed]",
        variant === "secondary" && "bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#ebebef]",
        variant === "ghost" && "text-[#0071e3] hover:bg-[#f5f5f7]",
        variant === "danger" && "text-[#9f1239] hover:bg-[#fff1f2]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
