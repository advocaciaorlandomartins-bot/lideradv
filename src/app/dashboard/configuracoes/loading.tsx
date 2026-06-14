export default function ConfiguracoesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-44 rounded-lg bg-slate-200" />
        <div className="h-4 w-56 rounded bg-slate-100" />
      </div>

      {Array.from({ length: 3 }).map((_, section) => (
        <div
          key={section}
          className="rounded-xl border border-border bg-white shadow-sm overflow-hidden"
        >
          <div className="border-b border-border px-5 py-4 bg-slate-50">
            <div className="h-5 w-40 rounded bg-slate-200" />
            <div className="mt-1 h-3 w-56 rounded bg-slate-100" />
          </div>
          <div className="p-5 space-y-5">
            {Array.from({ length: 3 }).map((_, field) => (
              <div key={field} className="space-y-1.5">
                <div className="h-3 w-32 rounded bg-slate-200" />
                <div className="h-10 w-full rounded-lg bg-slate-100" />
              </div>
            ))}
            <div className="flex justify-end pt-2">
              <div className="h-9 w-28 rounded-lg bg-slate-200" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
