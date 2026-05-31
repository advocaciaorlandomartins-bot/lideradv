"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Processo } from "@/lib/processos-db";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  FolderOpenIcon,
  ChevronRightIcon,
  UsersIcon,
  CalendarIcon,
} from "@/components/icons";

// ── Helpers ────────────────────────────────────────────────

const ESTAGIO_PROD: Record<string, { label: string; cls: string }> = {
  analise: { label: "Análise", cls: "bg-blue-50 text-blue-700" },
  producao: { label: "Produção", cls: "bg-teal-50 text-teal-700" },
  administrativo: {
    label: "Administrativo",
    cls: "bg-orange-50 text-orange-700",
  },
  judicial: { label: "Judicial", cls: "bg-purple-50 text-purple-700" },
  arquivado: { label: "Arquivado", cls: "bg-slate-100 text-slate-500" },
};

const AREA_COLORS: Record<string, string> = {
  Cível: "bg-blue-50 text-blue-600",
  Criminal: "bg-red-50 text-red-600",
  Trabalhista: "bg-orange-50 text-orange-600",
  Família: "bg-pink-50 text-pink-600",
  Previdenciário: "bg-purple-50 text-purple-600",
  Tributário: "bg-indigo-50 text-indigo-600",
  Administrativo: "bg-cyan-50 text-cyan-600",
  Consumidor: "bg-teal-50 text-teal-600",
  Imobiliário: "bg-emerald-50 text-emerald-600",
  Empresarial: "bg-violet-50 text-violet-600",
  Outro: "bg-slate-100 text-slate-500",
};

function areaColor(area: string) {
  return AREA_COLORS[area] ?? "bg-slate-100 text-slate-500";
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const PAGE_SIZE = 10;

// ── Subcomponents ──────────────────────────────────────────

const STATUS_STYLES: Record<
  string,
  { dot: string; wrap: string; label: string }
> = {
  ativo: {
    dot: "bg-emerald-500",
    wrap: "bg-emerald-50 text-emerald-700",
    label: "Ativo",
  },
  em_andamento: {
    dot: "bg-blue-500",
    wrap: "bg-blue-50 text-blue-700",
    label: "Em andamento",
  },
  arquivado: {
    dot: "bg-amber-500",
    wrap: "bg-amber-50 text-amber-700",
    label: "Arquivado",
  },
  encerrado: {
    dot: "bg-slate-400",
    wrap: "bg-slate-100 text-slate-500",
    label: "Encerrado",
  },
};

function StatusBadge({ status }: { status: Processo["status"] }) {
  const s = STATUS_STYLES[status] ?? {
    dot: "bg-slate-400",
    wrap: "bg-slate-100 text-slate-500",
    label: status,
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold ${s.wrap}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────

interface ProcessosContentProps {
  processos: Processo[];
}

type Filter = "todos" | "ativo" | "arquivado" | "encerrado";

const TAB_LABELS: Record<Filter, string> = {
  todos: "Todos",
  ativo: "Ativos",
  arquivado: "Arquivados",
  encerrado: "Encerrados",
};

const ACTIVE_LABEL: Record<Filter, string> = {
  todos: "Todos os Processos",
  ativo: "Processos Ativos",
  arquivado: "Processos Arquivados",
  encerrado: "Processos Encerrados",
};

export default function ProcessosContent({ processos }: ProcessosContentProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [page, setPage] = useState(1);

  const counts = useMemo(
    () => ({
      todos: processos.length,
      ativo: processos.filter((p) => p.status === "ativo").length,
      arquivado: processos.filter((p) => p.status === "arquivado").length,
      encerrado: processos.filter((p) => p.status === "encerrado").length,
    }),
    [processos]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return processos.filter((p) => {
      const matchSearch =
        !q ||
        p.tipo_acao.toLowerCase().includes(q) ||
        (p.numero ?? "").toLowerCase().includes(q) ||
        p.client_name.toLowerCase().includes(q) ||
        (p.parte_contraria ?? "").toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q);
      const matchFilter = filter === "todos" || p.status === filter;
      return matchSearch && matchFilter;
    });
  }, [processos, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function handleFilter(f: Filter) {
    setFilter(f);
    setPage(1);
  }

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  const tabs: { key: Filter; count: number }[] = [
    { key: "todos", count: counts.todos },
    { key: "ativo", count: counts.ativo },
    { key: "arquivado", count: counts.arquivado },
    { key: "encerrado", count: counts.encerrado },
  ];

  function pageWindow(): (number | "…")[] {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const left = Math.max(2, page - 2);
    const right = Math.min(totalPages - 1, page + 2);
    const pages: (number | "…")[] = [1];
    if (left > 2) pages.push("…");
    for (let i = left; i <= right; i++) pages.push(i);
    if (right < totalPages - 1) pages.push("…");
    pages.push(totalPages);
    return pages;
  }

  const valorTotal = filtered.reduce((sum, p) => sum + (p.valor_causa ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:grid-cols-4">
        {tabs.map((t) => {
          const active = filter === t.key;
          const style = STATUS_STYLES[t.key];
          return (
            <button
              key={t.key}
              onClick={() => handleFilter(t.key)}
              className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 transition-all duration-150 cursor-pointer sm:justify-start ${
                active
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-white hover:border-primary/40 hover:bg-slate-50"
              }`}
            >
              {style && (
                <span
                  className={`h-2 w-2 flex-shrink-0 rounded-full ${active ? style.dot : "bg-slate-300"}`}
                />
              )}
              <span
                className={`font-body text-sm font-semibold ${active ? "text-primary" : "text-muted"}`}
              >
                {TAB_LABELS[t.key]}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 font-body text-xs font-bold ${
                  active
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="overflow-hidden rounded-xl border border-border bg-white shadow-sm">
        {/* Panel header */}
        <div className="flex flex-col gap-3 border-b border-border bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <FolderOpenIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-heading text-sm font-bold text-fg">
                {ACTIVE_LABEL[filter]}
              </h2>
              <p className="font-body text-xs text-muted">
                {filtered.length}{" "}
                {filtered.length === 1 ? "processo" : "processos"}
                {valorTotal > 0 && ` · ${formatCurrency(valorTotal)} em causa`}
                {search ? ` para "${search}"` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Buscar número, tipo, cliente…"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                className="h-9 w-48 rounded-lg border border-border bg-white pl-9 pr-3 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 lg:w-56"
              />
            </div>
            <Link
              href="/dashboard/processos/novo"
              className="flex h-9 items-center gap-1.5 rounded-lg bg-cta px-3 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1 whitespace-nowrap"
            >
              <PlusIcon className="h-4 w-4" />
              Novo processo
            </Link>
          </div>
        </div>

        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FolderOpenIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum processo encontrado
            </p>
            <p className="font-body text-xs text-slate-400">
              {search
                ? "Tente ajustar os termos da busca"
                : "Ajuste os filtros acima"}
            </p>
            {!search && filter !== "todos" && (
              <button
                onClick={() => handleFilter("todos")}
                className="mt-1 cursor-pointer font-body text-sm font-semibold text-primary hover:underline"
              >
                Ver todos
              </button>
            )}
            {filter === "todos" && !search && (
              <Link
                href="/dashboard/processos/novo"
                className="mt-2 flex items-center gap-2 rounded-lg bg-cta px-4 py-2 font-body text-sm font-semibold text-white transition-colors hover:bg-cta-hover"
              >
                <PlusIcon className="h-4 w-4" />
                Cadastrar primeiro processo
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-slate-50/50">
                    <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Processo
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Vara / Comarca
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Distribuição
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Produção
                    </th>
                    <th className="px-5 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() =>
                        router.push(`/dashboard/processos/${p.id}`)
                      }
                      className="group cursor-pointer transition-colors duration-100 hover:bg-primary/5"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <FolderOpenIcon className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            {p.numero && (
                              <p className="font-mono text-xs text-muted">
                                {p.numero}
                              </p>
                            )}
                            <p className="truncate font-body text-sm font-semibold text-fg">
                              {p.tipo_acao}
                            </p>
                            <span
                              className={`mt-0.5 inline-block rounded px-1.5 py-0.5 font-body text-[11px] font-bold ${areaColor(p.area)}`}
                            >
                              {p.area}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/dashboard/clientes/${p.client_id}`);
                          }}
                          className="flex cursor-pointer items-center gap-1.5 font-body text-sm text-fg transition-colors duration-150 hover:text-primary"
                        >
                          <UsersIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
                          <span className="max-w-[140px] truncate">
                            {p.client_name}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-body text-sm text-fg">
                          {p.vara ? (
                            <span className="block max-w-[160px] truncate">
                              {p.vara}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                          {p.comarca && (
                            <span className="font-body text-xs text-muted">
                              {p.comarca}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {p.data_distribuicao ? (
                          <span className="flex items-center gap-1.5 font-body text-sm text-fg">
                            <CalendarIcon className="h-3.5 w-3.5 text-muted" />
                            {p.data_distribuicao}
                          </span>
                        ) : (
                          <span className="font-body text-sm text-muted">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        {(() => {
                          const ep =
                            ESTAGIO_PROD[p.estagio_producao] ??
                            ESTAGIO_PROD["analise"];
                          return (
                            <span
                              className={`inline-flex items-center rounded-full px-2 py-0.5 font-body text-[11px] font-semibold ${ep.cls}`}
                            >
                              {ep.label}
                            </span>
                          );
                        })()}
                      </td>
                      <td
                        className="px-5 py-3.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/processos/${p.id}`}
                            className="flex h-8 items-center rounded-lg border border-border px-3 font-body text-xs font-semibold text-fg transition-colors hover:border-primary hover:text-primary"
                          >
                            Editar
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <ul className="divide-y divide-border md:hidden">
              {paginated.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/dashboard/processos/${p.id}`}
                    className="flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-primary/5"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FolderOpenIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-body text-sm font-semibold text-fg">
                          {p.tipo_acao}
                        </p>
                        <span
                          className={`flex-shrink-0 rounded px-1.5 py-0.5 font-body text-[11px] font-bold ${areaColor(p.area)}`}
                        >
                          {p.area}
                        </span>
                      </div>
                      <p className="truncate font-body text-xs text-muted">
                        {p.client_name}
                      </p>
                      <div className="mt-1">
                        <StatusBadge status={p.status} />
                      </div>
                    </div>
                    <ChevronRightIcon className="h-4 w-4 flex-shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
            </ul>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-5 py-3">
                <p className="font-body text-xs text-muted">
                  {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, filtered.length)} de{" "}
                  {filtered.length}
                </p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    «
                  </button>
                  <button
                    onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    disabled={page === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    ‹
                  </button>
                  {pageWindow().map((n, i) =>
                    n === "…" ? (
                      <span
                        key={`ellipsis-${i}`}
                        className="flex h-8 w-8 items-center justify-center font-body text-sm text-muted"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg font-body text-sm transition-colors cursor-pointer ${
                          page === n
                            ? "bg-primary text-white font-semibold"
                            : "border border-border text-muted hover:border-primary hover:text-primary"
                        }`}
                      >
                        {n}
                      </button>
                    )
                  )}
                  <button
                    onClick={() =>
                      setPage((prev) => Math.min(totalPages, prev + 1))
                    }
                    disabled={page === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    ›
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
