/**
 * Ranking com barra de progresso horizontal — reaproveitado em qualquer
 * distribuição por categoria (tipo de ação, UF, cidade, origem). Mesmo
 * padrão visual usado em Assuntos/Tribunais/Origem no Tramita.
 */
export function RankingList({
  itens,
}: {
  itens: {
    key: string;
    label: string;
    total: number;
    pct: number;
    extra?: string;
  }[];
}) {
  if (itens.length === 0) return null;
  const maxTotal = Math.max(...itens.map((i) => i.total));
  return (
    <div className="space-y-3">
      {itens.map((item) => (
        <div key={item.key}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-body text-sm font-medium text-fg">
              {item.label}
            </span>
            <span className="flex-shrink-0 font-body text-xs text-muted">
              {item.total} · {item.pct}%{item.extra ? ` · ${item.extra}` : ""}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{ width: `${(item.total / maxTotal) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
