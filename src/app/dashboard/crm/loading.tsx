export default function CrmLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-24 rounded-lg bg-slate-200" />
          <div className="h-4 w-40 rounded bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-slate-200" />
          <div className="h-9 w-28 rounded-lg bg-slate-200" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-white p-4 shadow-sm space-y-2"
          >
            <div className="h-4 w-24 rounded bg-slate-200" />
            <div className="h-8 w-16 rounded-lg bg-slate-200" />
            <div className="h-3 w-28 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {Array.from({ length: 5 }).map((_, col) => (
          <div
            key={col}
            className="min-w-[240px] flex-shrink-0 rounded-xl border border-border bg-slate-50 p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="h-5 w-24 rounded bg-slate-200" />
              <div className="h-5 w-6 rounded-full bg-slate-200" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-white p-3 shadow-sm space-y-2"
                >
                  <div className="h-4 w-5/6 rounded bg-slate-200" />
                  <div className="h-3 w-2/3 rounded bg-slate-100" />
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-14 rounded-full bg-slate-200" />
                    <div className="h-3 w-16 rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
