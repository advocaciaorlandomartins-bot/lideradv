export default function AgendaLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="h-8 w-28 rounded-lg bg-slate-200" />
          <div className="h-4 w-40 rounded bg-slate-100" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 rounded-lg bg-slate-200" />
          <div className="h-9 w-36 rounded-lg bg-slate-200" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex gap-2">
            <div className="h-8 w-8 rounded-lg bg-slate-200" />
            <div className="h-8 w-36 rounded-lg bg-slate-200" />
            <div className="h-8 w-8 rounded-lg bg-slate-200" />
          </div>
          <div className="flex gap-2">
            {[60, 50, 60].map((w, i) => (
              <div
                key={i}
                style={{ width: w }}
                className="h-8 rounded-lg bg-slate-200"
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-border">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="border-r border-border px-2 py-2 last:border-r-0"
            >
              <div className="h-3 w-8 rounded bg-slate-200" />
            </div>
          ))}
        </div>

        {Array.from({ length: 5 }).map((_, row) => (
          <div
            key={row}
            className="grid grid-cols-7 border-b border-border last:border-0"
          >
            {Array.from({ length: 7 }).map((_, col) => (
              <div
                key={col}
                className="min-h-[80px] border-r border-border p-2 last:border-r-0"
              >
                <div className="h-4 w-5 rounded bg-slate-200" />
                {row === 1 && col === 2 && (
                  <div className="mt-1 h-5 rounded bg-blue-200 px-1" />
                )}
                {row === 2 && col === 4 && (
                  <div className="mt-1 h-5 rounded bg-green-200 px-1" />
                )}
                {row === 3 && col === 1 && (
                  <div className="mt-1 h-5 rounded bg-amber-200 px-1" />
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
