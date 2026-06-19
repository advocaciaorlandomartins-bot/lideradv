export default function NovoLancamentoLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Breadcrumb */}
      <div className="h-4 w-40 rounded bg-slate-200" />

      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 w-52 rounded-lg bg-slate-200" />
        <div className="h-4 w-80 rounded bg-slate-100" />
      </div>

      {/* Form card */}
      <div className="rounded-xl border border-border bg-white p-6 shadow-sm lg:p-8 space-y-8">
        {/* Tipo buttons */}
        <div className="flex gap-3">
          <div className="h-10 flex-1 rounded-xl bg-slate-200" />
          <div className="h-10 flex-1 rounded-xl bg-slate-100" />
        </div>

        {/* Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-32 rounded bg-slate-200" />
            <div className="flex-1 border-t border-border" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="h-4 w-16 rounded bg-slate-200" />
              <div className="h-11 w-full rounded-lg bg-slate-100" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-20 rounded bg-slate-200" />
              <div className="h-11 w-full rounded-lg bg-slate-100" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-24 rounded bg-slate-200" />
              <div className="h-11 w-full rounded-lg bg-slate-100" />
            </div>
            <div className="space-y-1.5">
              <div className="h-4 w-20 rounded bg-slate-200" />
              <div className="h-11 w-full rounded-lg bg-slate-100" />
            </div>
          </div>
        </div>

        {/* Payment mode section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-36 rounded bg-slate-200" />
            <div className="flex-1 border-t border-border" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 flex-1 rounded-xl bg-slate-100" />
            ))}
          </div>
          <div className="space-y-1.5">
            <div className="h-4 w-14 rounded bg-slate-200" />
            <div className="h-11 w-full rounded-lg bg-slate-100" />
          </div>
        </div>

        {/* Submit button */}
        <div className="h-11 w-40 rounded-lg bg-slate-200" />
      </div>
    </div>
  );
}
