export default function ClientesLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 rounded-lg bg-slate-200" />
          <div className="h-4 w-44 rounded bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-32 rounded-lg bg-slate-200" />
          <div className="h-9 w-36 rounded-lg bg-slate-200" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-9 w-72 rounded-lg bg-slate-200" />
          <div className="flex gap-2">
            <div className="h-9 w-24 rounded-lg bg-slate-200" />
            <div className="h-9 w-28 rounded-lg bg-slate-200" />
          </div>
        </div>

        <div className="hidden border-b border-border bg-slate-50/50 px-5 py-2.5 sm:flex gap-4">
          {[180, 120, 100, 80, 60].map((w, i) => (
            <div
              key={i}
              style={{ width: w }}
              className="h-3 rounded bg-slate-200"
            />
          ))}
        </div>

        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0"
          >
            <div className="h-9 w-9 flex-shrink-0 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 rounded bg-slate-200" />
              <div className="h-3 w-32 rounded bg-slate-100" />
            </div>
            <div className="hidden h-3 w-28 rounded bg-slate-100 sm:block" />
            <div className="h-6 w-20 rounded-full bg-slate-200" />
            <div className="flex gap-1.5">
              <div className="h-8 w-8 rounded-lg bg-slate-200" />
              <div className="h-8 w-8 rounded-lg bg-slate-200" />
            </div>
          </div>
        ))}

        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div className="h-4 w-40 rounded bg-slate-200" />
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-8 rounded-lg bg-slate-200" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
