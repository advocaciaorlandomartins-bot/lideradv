export default function ProcessoDetalheLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-slate-200" />
          <div className="space-y-1.5">
            <div className="h-7 w-56 rounded-lg bg-slate-200" />
            <div className="h-3 w-36 rounded bg-slate-100" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-lg bg-slate-200" />
          <div className="h-9 w-24 rounded-lg bg-slate-200" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b border-border pb-0">
        {[100, 90, 110, 80, 95, 85].map((w, i) => (
          <div
            key={i}
            style={{ minWidth: w }}
            className="h-9 rounded-t-lg bg-slate-200"
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-4">
            <div className="h-5 w-44 rounded bg-slate-200" />
            <div className="grid grid-cols-2 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-3 w-28 rounded bg-slate-200" />
                  <div className="h-4 w-40 rounded bg-slate-100" />
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="h-5 w-36 rounded bg-slate-200" />
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-4 border-b border-border px-5 py-4 last:border-0"
              >
                <div className="h-4 w-24 flex-shrink-0 rounded bg-slate-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 w-3/4 rounded bg-slate-200" />
                  <div className="h-3 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-3">
            <div className="h-5 w-32 rounded bg-slate-200" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <div className="h-3 w-20 rounded bg-slate-200" />
                <div className="h-4 w-36 rounded bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-3">
            <div className="h-5 w-36 rounded bg-slate-200" />
            <div className="h-24 w-full rounded-lg bg-slate-100" />
          </div>
        </div>
      </div>
    </div>
  );
}
