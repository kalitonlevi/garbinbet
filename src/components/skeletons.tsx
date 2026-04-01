export function FightCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#2A2A3A] overflow-hidden" style={{ background: "#16161F" }}>
      <div className="flex items-center justify-between px-4 py-2" style={{ background: "#1C1C28" }}>
        <div className="skeleton h-5 w-8" />
        <div className="skeleton h-5 w-24" />
      </div>
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="skeleton h-12 w-12 rounded-full" />
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-3 w-14" />
          </div>
          <div className="skeleton h-6 w-8 mx-3" />
          <div className="flex-1 flex flex-col items-center gap-2">
            <div className="skeleton h-12 w-12 rounded-full" />
            <div className="skeleton h-4 w-20" />
            <div className="skeleton h-3 w-14" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="skeleton h-14 rounded-lg" />
          <div className="skeleton h-14 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function BetCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#2A2A3A] overflow-hidden" style={{ background: "#16161F" }}>
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="skeleton h-4 w-36" />
            <div className="skeleton h-3 w-16" />
          </div>
          <div className="skeleton h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-[#2A2A3A]">
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-4 w-20" />
          <div className="skeleton h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

export function TransactionSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-xl border border-[#2A2A3A]" style={{ background: "#16161F" }}>
      <div className="skeleton h-5 w-5 rounded-full shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton h-4 w-20" />
        <div className="skeleton h-3 w-32" />
      </div>
      <div className="skeleton h-4 w-16" />
    </div>
  );
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#2A2A3A] overflow-hidden" style={{ background: "#16161F" }}>
      <div className="h-1 skeleton" />
      <div className="p-4 space-y-2">
        <div className="skeleton h-3 w-20" />
        <div className="skeleton h-7 w-16" />
      </div>
    </div>
  );
}
