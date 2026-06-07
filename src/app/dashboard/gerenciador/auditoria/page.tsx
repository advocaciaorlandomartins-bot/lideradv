import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { getAuditLogs, ACAO_META, ENTIDADE_META } from "@/lib/audit-db";

export const dynamic = "force-dynamic";

// ── Badge colours ─────────────────────────────────────────────────────────────

const ACAO_STYLE: Record<string, string> = {
  login: "bg-blue-100 text-blue-700 ring-blue-200",
  logout: "bg-slate-100 text-slate-600 ring-slate-200",
  criar: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  editar: "bg-amber-100 text-amber-700 ring-amber-200",
  excluir: "bg-red-100 text-red-700 ring-red-200",
  pagar: "bg-cyan-100 text-cyan-700 ring-cyan-200",
  reverter: "bg-orange-100 text-orange-700 ring-orange-200",
};

const ENTIDADE_STYLE: Record<string, string> = {
  lancamento: "bg-violet-100 text-violet-700",
  cliente: "bg-indigo-100 text-indigo-700",
  processo: "bg-sky-100 text-sky-700",
  colaborador: "bg-pink-100 text-pink-700",
  usuario: "bg-rose-100 text-rose-700",
  remuneracao: "bg-teal-100 text-teal-700",
  controle: "bg-lime-100 text-lime-700",
  compromisso: "bg-fuchsia-100 text-fuchsia-700",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUrl(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | number | undefined>
) {
  const p = new URLSearchParams();
  const merged = { ...base, ...overrides };
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  return `/dashboard/gerenciador/auditoria?${p.toString()}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const user = await getSession();
  if (!user || !hasPermission(user, "gerenciador", "ver")) notFound();

  const sp = await searchParams;
  const filters = {
    userLogin: sp.userLogin || undefined,
    acao: sp.acao || undefined,
    entidade: sp.entidade || undefined,
    dateFrom: sp.dateFrom || undefined,
    dateTo: sp.dateTo || undefined,
    search: sp.search || undefined,
    page: sp.page ? parseInt(sp.page) : 1,
    pageSize: sp.pageSize ? parseInt(sp.pageSize) : undefined,
  };

  const { logs, total, totalPages, distinctUsers, pageSize } =
    await getAuditLogs(filters);

  const searchFilters: Record<string, string> = {};
  if (filters.userLogin) searchFilters.userLogin = filters.userLogin;
  if (filters.acao) searchFilters.acao = filters.acao;
  if (filters.entidade) searchFilters.entidade = filters.entidade;
  if (filters.dateFrom) searchFilters.dateFrom = filters.dateFrom;
  if (filters.dateTo) searchFilters.dateTo = filters.dateTo;
  if (filters.search) searchFilters.search = filters.search;

  const hasFilters = Object.keys(searchFilters).length > 0;

  // currentFilters preserva tudo (inclui pageSize) para navegação de páginas
  const currentFilters: Record<string, string | undefined> = {
    ...searchFilters,
    ...(pageSize !== 20 ? { pageSize: String(pageSize) } : {}),
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-gray-900">
          Log de Auditoria
        </h1>
        <p className="mt-1 font-body text-sm text-gray-500">
          Histórico completo de quem fez o quê no sistema.
          {total > 0 && (
            <span className="ml-1 font-semibold text-fg">
              {total.toLocaleString("pt-BR")} registro{total !== 1 ? "s" : ""}
              {hasFilters && " filtrados"}.
            </span>
          )}
        </p>
      </div>

      {/* ── Filtros ── */}
      <form
        method="GET"
        action="/dashboard/gerenciador/auditoria"
        className="mb-6 rounded-xl border border-border bg-white p-4 shadow-sm"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Usuário */}
          <div>
            <label className="block font-body text-xs font-semibold text-muted mb-1">
              Usuário
            </label>
            <select
              name="userLogin"
              defaultValue={filters.userLogin ?? ""}
              className="h-9 w-full rounded-lg border border-border bg-white px-2 font-body text-sm text-fg outline-none focus:border-primary"
            >
              <option value="">Todos</option>
              {distinctUsers.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Ação */}
          <div>
            <label className="block font-body text-xs font-semibold text-muted mb-1">
              Ação
            </label>
            <select
              name="acao"
              defaultValue={filters.acao ?? ""}
              className="h-9 w-full rounded-lg border border-border bg-white px-2 font-body text-sm text-fg outline-none focus:border-primary"
            >
              <option value="">Todas</option>
              {Object.entries(ACAO_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {/* Módulo */}
          <div>
            <label className="block font-body text-xs font-semibold text-muted mb-1">
              Módulo
            </label>
            <select
              name="entidade"
              defaultValue={filters.entidade ?? ""}
              className="h-9 w-full rounded-lg border border-border bg-white px-2 font-body text-sm text-fg outline-none focus:border-primary"
            >
              <option value="">Todos</option>
              {Object.entries(ENTIDADE_META).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          {/* De */}
          <div>
            <label className="block font-body text-xs font-semibold text-muted mb-1">
              De
            </label>
            <input
              type="date"
              name="dateFrom"
              defaultValue={filters.dateFrom ?? ""}
              className="h-9 w-full rounded-lg border border-border bg-white px-2 font-body text-sm text-fg outline-none focus:border-primary"
            />
          </div>

          {/* Até */}
          <div>
            <label className="block font-body text-xs font-semibold text-muted mb-1">
              Até
            </label>
            <input
              type="date"
              name="dateTo"
              defaultValue={filters.dateTo ?? ""}
              className="h-9 w-full rounded-lg border border-border bg-white px-2 font-body text-sm text-fg outline-none focus:border-primary"
            />
          </div>

          {/* Busca + botões */}
          <div className="flex flex-col justify-end gap-1.5">
            <input
              type="text"
              name="search"
              defaultValue={filters.search ?? ""}
              placeholder="Buscar descrição…"
              className="h-9 w-full rounded-lg border border-border bg-white px-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none focus:border-primary"
            />
            <div className="flex gap-1.5">
              <button
                type="submit"
                className="flex-1 h-8 rounded-lg bg-primary px-3 font-body text-xs font-semibold text-white hover:bg-primary/90"
              >
                Filtrar
              </button>
              {hasFilters && (
                <Link
                  href="/dashboard/gerenciador/auditoria"
                  className="flex h-8 items-center rounded-lg border border-border px-2 font-body text-xs text-muted hover:text-fg"
                >
                  Limpar
                </Link>
              )}
            </div>
          </div>
        </div>
      </form>

      {/* ── Tabela ── */}
      {logs.length === 0 ? (
        <div className="rounded-xl border border-border bg-white py-16 text-center shadow-sm">
          <p className="font-body text-base font-semibold text-fg">
            Nenhum registro encontrado
          </p>
          <p className="mt-1 font-body text-sm text-muted">
            {hasFilters
              ? "Tente remover os filtros para ver mais resultados."
              : "Os eventos do sistema aparecerão aqui conforme forem ocorrendo."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-slate-50">
                <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  Data / Hora
                </th>
                <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  Usuário
                </th>
                <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  Ação
                </th>
                <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  Módulo
                </th>
                <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                  Descrição
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((log) => {
                const acaoStyle =
                  ACAO_STYLE[log.acao] ??
                  "bg-slate-100 text-slate-600 ring-slate-200";
                const entidadeStyle =
                  ENTIDADE_STYLE[log.entidade] ?? "bg-slate-100 text-slate-600";
                const acaoLabel = ACAO_META[log.acao]?.label ?? log.acao;
                const entidadeLabel =
                  ENTIDADE_META[log.entidade] ?? log.entidade;

                return (
                  <tr
                    key={log.id}
                    className="hover:bg-slate-50/60 transition-colors"
                  >
                    {/* Data/Hora */}
                    <td className="whitespace-nowrap px-4 py-3 font-body text-xs text-muted">
                      {log.created_at_fmt}
                    </td>

                    {/* Usuário */}
                    <td className="px-4 py-3">
                      <div className="font-body text-sm font-semibold text-fg leading-tight">
                        {log.user_login}
                      </div>
                      {log.user_cat && (
                        <div className="font-body text-xs text-muted capitalize">
                          {log.user_cat}
                        </div>
                      )}
                    </td>

                    {/* Ação */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ring-1 ${acaoStyle}`}
                      >
                        {acaoLabel}
                      </span>
                    </td>

                    {/* Módulo */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${entidadeStyle}`}
                      >
                        {entidadeLabel}
                      </span>
                    </td>

                    {/* Descrição */}
                    <td className="px-4 py-3 font-body text-sm text-fg max-w-xs">
                      <span className="line-clamp-2">
                        {log.descricao ?? "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ── Paginação ── */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3 flex-wrap gap-2">
            {/* Exibir X por página */}
            <div className="flex items-center gap-2">
              <span className="font-body text-xs text-muted">Exibir:</span>
              {[10, 20, 50].map((n) => (
                <Link
                  key={n}
                  href={buildUrl(
                    {
                      ...currentFilters,
                      pageSize: n !== 20 ? String(n) : undefined,
                    },
                    { page: 1 }
                  )}
                  className={`flex h-7 min-w-[2rem] items-center justify-center rounded-md px-2 font-body text-xs font-semibold transition-colors ${
                    pageSize === n
                      ? "bg-primary text-white"
                      : "border border-border text-muted hover:text-fg hover:border-slate-300"
                  }`}
                >
                  {n}
                </Link>
              ))}
              <span className="font-body text-xs text-muted ml-1">
                — {total.toLocaleString("pt-BR")} registro
                {total !== 1 ? "s" : ""}
                {totalPages > 1 && `, página ${filters.page} de ${totalPages}`}
              </span>
            </div>

            {/* Anterior / Próxima */}
            <div className="flex gap-1.5">
              {filters.page! > 1 && (
                <Link
                  href={buildUrl(currentFilters, { page: filters.page! - 1 })}
                  className="flex h-8 items-center rounded-lg border border-border px-3 font-body text-xs text-muted hover:text-fg hover:border-slate-300"
                >
                  ← Anterior
                </Link>
              )}
              {filters.page! < totalPages && (
                <Link
                  href={buildUrl(currentFilters, { page: filters.page! + 1 })}
                  className="flex h-8 items-center rounded-lg border border-border px-3 font-body text-xs text-muted hover:text-fg hover:border-slate-300"
                >
                  Próxima →
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
