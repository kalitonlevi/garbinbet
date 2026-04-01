import { BetCardSkeleton } from "@/components/skeletons";

export default function MyBetsLoading() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <div className="skeleton h-5 w-5 rounded" />
        <div className="skeleton h-7 w-40" />
      </div>
      <div className="flex border-b border-[#2A2A3A]">
        <div className="flex-1 pb-2.5 flex justify-center">
          <div className="skeleton h-4 w-16" />
        </div>
        <div className="flex-1 pb-2.5 flex justify-center">
          <div className="skeleton h-4 w-20" />
        </div>
      </div>
      <div className="space-y-3">
        <BetCardSkeleton />
        <BetCardSkeleton />
        <BetCardSkeleton />
      </div>
    </div>
  );
}
