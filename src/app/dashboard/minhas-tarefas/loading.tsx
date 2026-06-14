export default function MinhasTarefasLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-44 rounded-lg bg-slate-200" />
          <div className="h-4 w-36 rounded bg-slate-100" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-slate-200" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-white p-4 shadow-sm space-y-1"
          >
            <div className="h-7 w-12 rounded-lg bg-slate-200" />
            <div className="h-3 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[80, 90, 100, 75].map((w, i) => (
          <div
            key={i}
            style={{ minWidth: w }}
            className="h-9 rounded-lg bg-slate-200"
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-start gap-4 border-b border-border px-5 py-4 last:border-0"
          >
            <div className="mt-0.5 h-5 w-5 flex-shrink-0 rounded bg-slate-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <div className="h-5 w-16 rounded-full bg-slate-200" />
              <div className="h-5 w-20 rounded-full bg-slate-200" />
              <div className="h-8 w-8 rounded-lg bg-slate-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
