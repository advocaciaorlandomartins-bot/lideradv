"use client";

import { useState, useMemo } from "react";
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

const PAGE_SIZE = 8;

// ── Subcomponents ──────────────────────────────────────────

function StatusBadge({ status }: { status: Processo["status"] }) {
  const styles = {
    ativo: {
      dot: "bg-emerald-500",
      wrap: "bg-emerald-50 text-emerald-700",
      label: "Ativo",
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
  const s = styles[status];
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

export default function ProcessosContent({ processos }: ProcessosContentProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [page, setPage] = useState(1);

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

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const counts = useMemo(
    () => ({
      todos: processos.length,
      ativo: processos.filter((p) => p.status === "ativo").length,
      arquivado: processos.filter((p) => p.status === "arquivado").length,
      encerrado: processos.filter((p) => p.status === "encerrado").length,
    }),
    [processos]
  );

  function handleFilter(f: Filter) {
    setFilter(f);
    setPage(1);
  }

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  const tabs: { key: Filter; label: string; count: number }[] = [
    { key: "todos", label: "Todos", count: counts.todos },
    { key: "ativo", label: "Ativos", count: counts.ativo },
    { key: "arquivado", label: "Arquivados", count: counts.arquivado },
    { key: "encerrado", label: "Encerrados", count: counts.encerrado },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Buscar por número, tipo ou cliente…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <Link
          href="/dashboard/processos/novo"
          className="flex h-10 items-center gap-2 rounded-lg bg-cta px-4 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1"
        >
          <PlusIcon className="h-4 w-4" />
          Novo processo
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-white p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => handleFilter(t.key)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-body text-sm transition-colors duration-150 cursor-pointer ${
              filter === t.key
                ? "bg-primary text-white font-semibold"
                : "text-muted hover:text-fg"
            }`}
          >
            {t.label}
            <span
              className={`rounded-full px-1.5 py-0.5 font-body text-[11px] font-bold ${
                filter === t.key
                  ? "bg-white/20 text-white"
                  : "bg-slate-100 text-muted"
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <FolderOpenIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum processo encontrado
            </p>
            <p className="font-body text-xs text-slate-400">
              Tente ajustar a busca ou os filtros
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
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
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((p) => (
                    <tr
                      key={p.id}
                      className="group transition-colors duration-100 hover:bg-slate-50"
                    >
                      {/* Processo */}
                      <td className="px-5 py-4">
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
                      {/* Cliente */}
                      <td className="px-4 py-4">
                        <Link
                          href={`/dashboard/clientes/${p.client_id}`}
                          className="flex items-center gap-1.5 font-body text-sm text-fg hover:text-primary transition-colors duration-150"
                        >
                          <UsersIcon className="h-3.5 w-3.5 flex-shrink-0 text-muted" />
                          <span className="truncate max-w-[140px]">
                            {p.client_name}
                          </span>
                        </Link>
                      </td>
                      {/* Vara */}
                      <td className="px-4 py-4">
                        <div className="font-body text-sm text-fg">
                          {p.vara ? (
                            <span className="truncate max-w-[160px] block">
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
                      {/* Data */}
                      <td className="px-4 py-4">
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
                      {/* Status */}
                      <td className="px-4 py-4">
                        <StatusBadge status={p.status} />
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <Link
                          href={`/dashboard/processos/${p.id}`}
                          className="flex items-center gap-1 font-body text-sm font-semibold text-primary opacity-0 transition-opacity duration-150 hover:text-primary-dark group-hover:opacity-100 focus:opacity-100"
                        >
                          Ver
                          <ChevronRightIcon className="h-4 w-4" />
                        </Link>
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
                    className="flex items-center gap-3 px-4 py-4 transition-colors duration-150 hover:bg-slate-50"
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
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors duration-150 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (n) => (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg font-body text-sm transition-colors duration-150 cursor-pointer ${
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
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors duration-150 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Valor total */}
      {filtered.length > 0 && (
        <div className="flex justify-end">
          <p className="font-body text-xs text-muted">
            Valor total em causa:{" "}
            <span className="font-semibold text-fg">
              {formatCurrency(
                filtered.reduce((sum, p) => sum + (p.valor_causa ?? 0), 0)
              )}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
