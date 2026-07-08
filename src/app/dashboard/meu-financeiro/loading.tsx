export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-9 w-48 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-1 h-4 w-72 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-border bg-slate-100"
          />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-border bg-slate-100" />
    </div>
  );
}
