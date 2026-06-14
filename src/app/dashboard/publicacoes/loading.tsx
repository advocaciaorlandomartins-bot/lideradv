export default function PublicacoesLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-40 rounded-lg bg-slate-200" />
          <div className="h-4 w-56 rounded bg-slate-100" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-slate-200" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[100, 80, 90, 70, 85].map((w, i) => (
          <div
            key={i}
            style={{ minWidth: w }}
            className="h-9 rounded-lg bg-slate-200"
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-9 w-64 rounded-lg bg-slate-200" />
          <div className="h-9 w-24 rounded-lg bg-slate-200" />
        </div>

        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 border-b border-border px-5 py-4 last:border-0 sm:flex-row sm:items-start"
          >
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
              <div className="h-3 w-2/3 rounded bg-slate-100" />
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <div className="h-6 w-20 rounded-full bg-slate-200" />
              <div className="h-8 w-8 rounded-lg bg-slate-200" />
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="flex gap-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 w-8 rounded-lg bg-slate-200" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
