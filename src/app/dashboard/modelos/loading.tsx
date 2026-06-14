export default function ModelosLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-32 rounded-lg bg-slate-200" />
          <div className="h-4 w-48 rounded bg-slate-100" />
        </div>
        <div className="h-9 w-36 rounded-lg bg-slate-200" />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[80, 100, 90, 110, 85].map((w, i) => (
          <div
            key={i}
            style={{ minWidth: w }}
            className="h-9 rounded-lg bg-slate-200"
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-9 w-72 rounded-lg bg-slate-200" />
        <div className="h-9 w-24 rounded-lg bg-slate-200" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-white p-5 shadow-sm space-y-3"
          >
            <div className="h-10 w-10 rounded-lg bg-slate-200" />
            <div className="h-5 w-3/4 rounded bg-slate-200" />
            <div className="h-3 w-full rounded bg-slate-100" />
            <div className="h-3 w-2/3 rounded bg-slate-100" />
            <div className="flex items-center justify-between pt-1">
              <div className="h-5 w-16 rounded-full bg-slate-200" />
              <div className="flex gap-1.5">
                <div className="h-8 w-8 rounded-lg bg-slate-200" />
                <div className="h-8 w-8 rounded-lg bg-slate-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
