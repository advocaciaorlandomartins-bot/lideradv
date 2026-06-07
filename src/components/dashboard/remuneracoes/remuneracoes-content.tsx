"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import type { Remuneracao, RemuneracaoKpis } from "@/lib/remuneracoes-db";
import { TIPO_LABELS, TIPO_COLORS } from "@/lib/remuneracoes-types";
import {
  markRemuneracaoPagaAction,
  deleteRemuneracaoAction,
} from "@/lib/remuneracao-actions";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  CurrencyIcon,
  CheckIcon,
  CalendarIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { CARGO_LABELS } from "@/lib/colaboradores-types";
import type { CargoColaborador } from "@/lib/colaboradores-types";

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function KpiCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
      <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-2 font-heading text-2xl font-semibold ${color}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 font-body text-xs text-muted">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status }: { status: "pendente" | "pago" }) {
  return status === "pago" ? (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold bg-emerald-50 text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Pago
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-body text-xs font-semibold bg-amber-50 text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Pendente
    </span>
  );
}

function MarkPagaButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => markRemuneracaoPagaAction(id))}
      disabled={isPending}
      title="Marcar como pago"
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 text-emerald-600 transition-colors duration-150 hover:bg-emerald-50 disabled:opacity-50 cursor-pointer"
    >
      <CheckIcon className="h-3.5 w-3.5" />
    </button>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Excluir este lançamento?")) return;
        startTransition(() => deleteRemuneracaoAction(id));
      }}
      disabled={isPending}
      title="Excluir"
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 text-red-500 transition-colors duration-150 hover:bg-red-50 disabled:opacity-50 cursor-pointer font-body text-xs font-bold"
    >
      ×
    </button>
  );
}

type TipoFilter = "todos" | string;
type StatusFilter = "todos" | "pendente" | "pago";

interface Props {
  remuneracoes: Remuneracao[];
  kpis: RemuneracaoKpis;
}

export default function RemuneracoesContent({ remuneracoes, kpis }: Props) {
  const [search, setSearch] = useState("");
  const [tipoFilter, setTipoFilter] = useState<TipoFilter>("todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [competenciaFilter, setCompetenciaFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return remuneracoes.filter((r) => {
      const matchSearch =
        !q ||
        r.colaborador_nome.toLowerCase().includes(q) ||
        (r.descricao ?? "").toLowerCase().includes(q) ||
        (r.processo_tipo ?? "").toLowerCase().includes(q);
      const matchTipo = tipoFilter === "todos" || r.tipo === tipoFilter;
      const matchStatus = statusFilter === "todos" || r.status === statusFilter;
      const matchComp =
        !competenciaFilter ||
        (r.competencia_iso ?? "").startsWith(competenciaFilter);
      return matchSearch && matchTipo && matchStatus && matchComp;
    });
  }, [remuneracoes, search, tipoFilter, statusFilter, competenciaFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  function reset(fn: () => void) {
    fn();
    setPage(1);
  }

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "pendente", label: "Pendentes" },
    { key: "pago", label: "Pagos" },
  ];

  const totalFiltrado = filtered.reduce((s, r) => s + r.valor, 0);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard
          label="A Pagar"
          value={formatCurrency(kpis.aPagar)}
          color="text-red-600"
        />
        <KpiCard
          label="Pago"
          value={formatCurrency(kpis.pago)}
          color="text-emerald-600"
        />
        <KpiCard
          label="Salários"
          value={formatCurrency(kpis.salarios)}
          color="text-blue-600"
        />
        <KpiCard
          label="Comissões"
          value={formatCurrency(kpis.comissoes)}
          color="text-emerald-700"
        />
        <KpiCard
          label="Bonificações"
          value={formatCurrency(kpis.bonificacoes)}
          color="text-amber-700"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative max-w-xs flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="search"
              placeholder="Buscar colaborador…"
              value={search}
              onChange={(e) => reset(() => setSearch(e.target.value))}
              className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <input
            type="month"
            value={competenciaFilter}
            onChange={(e) => reset(() => setCompetenciaFilter(e.target.value))}
            title="Filtrar por competência"
            className="h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors duration-150 focus:border-primary focus:ring-2 focus:ring-blue-100 cursor-pointer"
          />
          {competenciaFilter && (
            <button
              onClick={() => reset(() => setCompetenciaFilter(""))}
              className="h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-muted hover:text-fg transition-colors duration-150 cursor-pointer"
            >
              Limpar mês
            </button>
          )}
        </div>
        <Link
          href="/dashboard/remuneracoes/nova"
          className="flex h-10 items-center gap-2 rounded-lg bg-cta px-4 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-1"
        >
          <PlusIcon className="h-4 w-4" />
          Novo lançamento
        </Link>
      </div>

      {/* Tipo filter */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            "todos",
            "salario",
            "comissao",
            "bonificacao",
            "adiantamento",
          ] as const
        ).map((t) => (
          <button
            key={t}
            onClick={() => reset(() => setTipoFilter(t))}
            className={`rounded-full px-3 py-1 font-body text-xs font-semibold transition-colors duration-150 cursor-pointer ${
              tipoFilter === t
                ? "bg-primary text-white"
                : "border border-border bg-white text-muted hover:text-fg"
            }`}
          >
            {t === "todos" ? "Todos os tipos" : TIPO_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-white p-1 w-fit">
        {statusTabs.map((t) => (
          <button
            key={t.key}
            onClick={() => reset(() => setStatusFilter(t.key))}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-body text-sm transition-colors duration-150 cursor-pointer ${
              statusFilter === t.key
                ? "bg-primary text-white font-semibold"
                : "text-muted hover:text-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm">
        {paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <CurrencyIcon className="h-10 w-10 text-slate-300" />
            <p className="font-body text-sm font-semibold text-muted">
              Nenhum lançamento encontrado
            </p>
            <p className="font-body text-xs text-slate-400">
              Tente ajustar os filtros
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Colaborador
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Competência
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Descrição
                    </th>
                    <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Valor
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Status
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginated.map((r) => (
                    <tr
                      key={r.id}
                      className="group transition-colors duration-100 hover:bg-slate-50"
                    >
                      {/* Colaborador */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-body text-sm font-semibold text-primary">
                            {r.colaborador_nome.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-body text-sm font-semibold text-fg">
                              {r.colaborador_nome}
                            </p>
                            <p className="font-body text-xs text-muted">
                              {CARGO_LABELS[
                                r.colaborador_cargo as CargoColaborador
                              ] ?? r.colaborador_cargo}
                            </p>
                          </div>
                        </div>
                      </td>
                      {/* Tipo */}
                      <td className="px-4 py-4">
                        <span
                          className={`rounded px-1.5 py-0.5 font-body text-xs font-semibold ${TIPO_COLORS[r.tipo]}`}
                        >
                          {TIPO_LABELS[r.tipo]}
                        </span>
                      </td>
                      {/* Competência */}
                      <td className="px-4 py-4">
                        {r.competencia ? (
                          <span className="flex items-center gap-1.5 font-body text-sm text-fg">
                            <CalendarIcon className="h-3.5 w-3.5 text-muted" />
                            {r.competencia}
                          </span>
                        ) : (
                          <span className="font-body text-sm text-muted">
                            —
                          </span>
                        )}
                      </td>
                      {/* Descrição */}
                      <td className="px-4 py-4">
                        <p className="truncate max-w-[200px] font-body text-sm text-fg">
                          {r.descricao ??
                            (r.processo_tipo ? (
                              <span className="flex items-center gap-1">
                                <ChevronRightIcon className="h-3 w-3" />
                                {r.processo_tipo}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            ))}
                        </p>
                      </td>
                      {/* Valor */}
                      <td className="px-4 py-4 text-right">
                        <span className="font-body text-sm font-semibold text-fg">
                          {formatCurrency(r.valor)}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={r.status} />
                          {r.status === "pendente" && (
                            <MarkPagaButton id={r.id} />
                          )}
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-4">
                        <DeleteButton id={r.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <ul className="divide-y divide-border md:hidden">
              {paginated.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-body text-sm font-semibold text-primary">
                    {r.colaborador_nome.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-body text-sm font-semibold text-fg">
                        {r.colaborador_nome}
                      </p>
                      <span
                        className={`rounded px-1.5 py-0.5 font-body text-[11px] font-bold ${TIPO_COLORS[r.tipo]}`}
                      >
                        {TIPO_LABELS[r.tipo]}
                      </span>
                    </div>
                    <p className="font-body text-xs text-muted">
                      {r.competencia ?? r.created_at_formatted}
                      {r.descricao ? ` · ${r.descricao}` : ""}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-body text-sm font-semibold text-fg">
                        {formatCurrency(r.valor)}
                      </span>
                      <StatusBadge status={r.status} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {r.status === "pendente" && <MarkPagaButton id={r.id} />}
                    <DeleteButton id={r.id} />
                  </div>
                </li>
              ))}
            </ul>

            {/* Pagination */}
            {filtered.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                <div className="flex items-center gap-1">
                  <span className="mr-1 font-body text-xs text-muted">
                    Exibir:
                  </span>
                  {[10, 20, 50].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setPageSize(s);
                        setPage(1);
                      }}
                      className={`h-7 min-w-[2rem] rounded px-1.5 font-body text-xs transition-colors cursor-pointer ${pageSize === s ? "bg-primary font-semibold text-white" : "text-muted hover:text-fg"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <p className="mr-1 font-body text-xs text-muted">
                    {(page - 1) * pageSize + 1}–
                    {Math.min(page * pageSize, filtered.length)} de{" "}
                    {filtered.length}
                  </p>
                  {totalPages > 1 && (
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
                        onClick={() =>
                          setPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={page === totalPages}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border font-body text-sm text-muted transition-colors duration-150 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Total */}
            <div className="flex justify-end border-t border-border px-5 py-3">
              <p className="font-body text-xs text-muted">
                Total filtrado:{" "}
                <span className="font-semibold text-fg">
                  {formatCurrency(totalFiltrado)}
                </span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
