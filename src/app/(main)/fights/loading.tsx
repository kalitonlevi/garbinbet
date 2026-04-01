import { FightCardSkeleton } from "@/components/skeletons";

export default function FightsLoading() {
  return (
    <div className="space-y-5">
      {/* Event header skeleton */}
      <div className="flex flex-col items-center gap-2 py-2">
        <div className="skeleton h-4 w-4 rounded-full" />
        <div className="skeleton h-7 w-48" />
        <div className="skeleton h-3 w-32" />
      </div>

      {/* Fight cards skeleton */}
      <div className="space-y-4">
        <FightCardSkeleton />
        <FightCardSkeleton />
        <FightCardSkeleton />
      </div>
    </div>
  );
}
