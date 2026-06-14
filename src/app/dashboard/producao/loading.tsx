export default function ProducaoLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-36 rounded-lg bg-slate-200" />
          <div className="h-4 w-44 rounded bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-slate-200" />
          <div className="h-9 w-32 rounded-lg bg-slate-200" />
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2">
        {["bg-slate-100", "bg-blue-50", "bg-amber-50", "bg-green-50"].map(
          (bg, col) => (
            <div
              key={col}
              className={`min-w-[260px] flex-shrink-0 rounded-xl border border-border ${bg} p-3`}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="h-5 w-28 rounded bg-slate-200" />
                <div className="h-5 w-6 rounded-full bg-slate-200" />
              </div>
              <div className="space-y-2">
                {Array.from({
                  length: col === 0 ? 4 : col === 1 ? 3 : col === 2 ? 5 : 2,
                }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-border bg-white p-3 shadow-sm space-y-2"
                  >
                    <div className="h-4 w-5/6 rounded bg-slate-200" />
                    <div className="h-3 w-3/4 rounded bg-slate-100" />
                    <div className="flex items-center justify-between">
                      <div className="h-5 w-16 rounded-full bg-slate-200" />
                      <div className="h-6 w-6 rounded-full bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
