import Link from "next/link";
import { cn } from "@/lib/utils";

export function Chip({
  href,
  onClick,
  children,
  active,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  const className = cn(
    "inline-flex rounded-full border px-2.5 py-1 text-xs text-[#1d1d1f]",
    active ? "border-[#0071e3] bg-[#e8f2ff]" : "border-[#e6e6ea] bg-white hover:border-[#c5c5c9]",
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
