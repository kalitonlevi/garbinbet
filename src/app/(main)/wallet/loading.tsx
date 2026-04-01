import { TransactionSkeleton } from "@/components/skeletons";

export default function WalletLoading() {
  return (
    <div className="space-y-6">
      <div className="text-center py-6 space-y-2">
        <div className="skeleton h-3 w-16 mx-auto" />
        <div className="skeleton h-10 w-40 mx-auto" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-12 rounded-lg" />
        <div className="skeleton h-12 rounded-lg" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-5 w-20 mb-3" />
        <TransactionSkeleton />
        <TransactionSkeleton />
        <TransactionSkeleton />
      </div>
    </div>
  );
}
