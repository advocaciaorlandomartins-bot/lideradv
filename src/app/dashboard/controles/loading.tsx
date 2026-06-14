export default function ControlesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-44 rounded-lg bg-slate-200" />
          <div className="h-4 w-28 rounded bg-slate-200" />
        </div>
        <div className="h-10 w-36 rounded-lg bg-slate-200" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {[120, 90, 100, 80, 110, 95, 105, 90].map((w, i) => (
          <div
            key={i}
            style={{ minWidth: w }}
            className="h-9 rounded-lg bg-slate-200"
          />
        ))}
      </div>

      {/* Painel principal */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-9 w-64 rounded-lg bg-slate-200" />
          <div className="flex gap-2">
            <div className="h-9 w-24 rounded-lg bg-slate-200" />
            <div className="h-9 w-28 rounded-lg bg-slate-200" />
          </div>
        </div>

        {/* Total */}
        <div className="px-5 py-2">
          <div className="h-3 w-32 rounded bg-slate-200" />
        </div>

        {/* Linhas da tabela */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-0"
          >
            <div className="h-4 w-24 shrink-0 rounded bg-slate-200" />
            <div className="h-5 w-20 shrink-0 rounded-full bg-slate-200" />
            <div className="h-4 flex-1 rounded bg-slate-200" />
            <div className="hidden h-4 w-36 shrink-0 rounded bg-slate-200 sm:block" />
            <div className="h-6 w-20 shrink-0 rounded-full bg-slate-200" />
            <div className="flex shrink-0 gap-1.5">
              <div className="h-8 w-8 rounded-lg bg-slate-200" />
              <div className="h-8 w-8 rounded-lg bg-slate-200" />
              <div className="h-8 w-8 rounded-lg bg-slate-200" />
            </div>
          </div>
        ))}

        {/* Paginação */}
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
