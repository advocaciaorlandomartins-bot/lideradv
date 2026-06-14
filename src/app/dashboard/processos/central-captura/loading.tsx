export default function CentralCapturaLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-48 rounded-lg bg-slate-200" />
          <div className="h-4 w-56 rounded bg-slate-100" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-slate-200" />
      </div>

      <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4">
        <div className="h-5 w-40 rounded bg-slate-200" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-slate-200" />
              <div className="h-10 w-full rounded-lg bg-slate-100" />
            </div>
          ))}
        </div>
        <div className="h-10 w-36 rounded-lg bg-slate-200" />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <div className="h-5 w-44 rounded bg-slate-200" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0"
          >
            <div className="h-4 w-28 flex-shrink-0 rounded bg-slate-200" />
            <div className="flex-1 h-4 rounded bg-slate-200" />
            <div className="h-6 w-20 flex-shrink-0 rounded-full bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
