export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded-lg bg-slate-200" />
          <div className="h-4 w-40 rounded bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-lg bg-slate-200" />
          <div className="h-9 w-28 rounded-lg bg-slate-200" />
        </div>
      </div>

      {/* Cards skeleton */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="h-10 w-10 rounded-lg bg-slate-100" />
              <div className="h-4 w-12 rounded bg-slate-100" />
            </div>
            <div className="mt-3 h-8 w-16 rounded-lg bg-slate-200" />
            <div className="mt-1 h-3 w-20 rounded bg-slate-100" />
            <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Table / list skeleton */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="h-5 w-48 rounded bg-slate-200" />
          <div className="mt-1 h-3 w-32 rounded bg-slate-100" />
        </div>
        <div className="divide-y divide-border">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3.5">
              <div className="h-9 w-9 flex-shrink-0 rounded-full bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-48 rounded bg-slate-200" />
                <div className="h-3 w-32 rounded bg-slate-100" />
              </div>
              <div className="h-4 w-20 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
