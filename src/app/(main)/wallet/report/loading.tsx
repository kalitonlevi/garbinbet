export default function ReportLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-6 w-56" />
      <div className="skeleton h-20 w-full rounded-xl" />
      <div className="skeleton h-24 w-full rounded-xl" />
      <div className="skeleton h-28 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
      </div>
      <div className="skeleton h-40 w-full rounded-xl" />
      <div className="skeleton h-28 w-full rounded-xl" />
      <div className="skeleton h-28 w-full rounded-xl" />
    </div>
  );
}
