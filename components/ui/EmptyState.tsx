export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#e6e6ea] bg-[#fafafa] px-6 py-10 text-center">
      <p className="text-sm font-medium text-[#1d1d1f]">{title}</p>
      {detail && <p className="mt-1 text-sm text-[#6e6e73]">{detail}</p>}
    </div>
  );
}
