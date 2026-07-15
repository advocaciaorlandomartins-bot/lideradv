"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  markAsPagoAction,
  revertParaPendenteAction,
} from "@/lib/lancamento-actions";
import type { Lancamento } from "@/lib/lancamentos-db";
import { MagnifyingGlassIcon, PlusIcon } from "@/components/icons";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseVencimento(s: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split("/");
  return new Date(Number(y), Number(m) - 1, Number(d));
}

type Periodo = "todos" | "mes_atual" | "personalizado";

function matchesPeriodo(
  d: Date | null,
  periodo: Periodo,
  inicio: string,
  fim: string
): boolean {
  if (periodo === "todos") return true;
  if (!d) return false;
  if (periodo === "mes_atual") {
    const now = new Date();
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  }
  if (inicio && d < new Date(inicio + "T00:00:00")) return false;
  if (fim && d > new Date(fim + "T23:59:59")) return false;
  return true;
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({
  status,
  atrasado,
}: {
  status: string;
  atrasado: boolean;
}) {
  if (status === "pago")
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-body text-xs font-semibold text-emerald-700">
        Pago
      </span>
    );
  if (atrasado)
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 font-body text-xs font-semibold text-red-700">
        Vencido
      </span>
    );
  return (
    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-body text-xs font-semibold text-amber-700">
      Pendente
    </span>
  );
}

// ── DespesaRow ────────────────────────────────────────────────────────────────

function DespesaRow({
  item,
  onBaixa,
  onDesfazer,
  isPending,
}: {
  item: Lancamento;
  onBaixa: (id: string) => void;
  onDesfazer: (id: string) => void;
  isPending: boolean;
}) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const venc = parseVencimento(item.data_vencimento);
  const atrasado = item.status === "pendente" && venc !== null && venc < hoje;

  return (
    <tr
      className={`border-b border-border transition-colors ${
        item.status === "pago"
          ? "bg-slate-50/60 opacity-70"
          : atrasado
            ? "bg-red-50/40"
            : "bg-white"
      }`}
    >
      <td className="px-4 py-3 w-[110px]">
        <span
          className={`font-body text-xs font-semibold ${atrasado ? "text-red-600" : "text-fg"}`}
        >
          {item.data_vencimento}
        </span>
        {atrasado && (
          <p className="font-body text-[10px] text-red-500 mt-0.5">Vencido</p>
        )}
        {item.data_pagamento && (
          <p className="font-body text-[10px] text-emerald-600 mt-0.5">
            Pago {item.data_pagamento}
          </p>
        )}
      </td>
      <td className="px-4 py-3 min-w-0">
        <p className="font-body text-sm font-semibold text-fg truncate">
          {item.descricao}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {item.categoria && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-body text-[10px] text-muted">
              {item.categoria}
            </span>
          )}
          {item.client_name && (
            <span className="font-body text-[10px] text-muted">
              {item.client_name}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="font-body text-sm font-semibold text-red-600 tabular-nums">
          {fmt(item.valor)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <StatusBadge status={item.status} atrasado={atrasado} />
          {item.status === "pendente" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onBaixa(item.id)}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-body text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Paguei
            </button>
          )}
          {item.status === "pago" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onDesfazer(item.id)}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 font-body text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Desfazer
            </button>
          )}
          <Link
            href={`/dashboard/financeiro/${item.id}/editar`}
            className="rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg hover:bg-slate-100 transition-colors"
          >
            Editar
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ── Main: PagarContent ────────────────────────────────────────────────────────

interface Props {
  despesas: Lancamento[];
  canEdit: boolean;
}

export default function PagarContent({ despesas, canEdit }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [categoriaFilter, setCategoriaFilter] = useState("todas");
  const [mostrarPagas, setMostrarPagas] = useState(false);

  function handleBaixa(id: string) {
    startTransition(async () => {
      await markAsPagoAction(id);
      router.refresh();
    });
  }

  function handleDesfazer(id: string) {
    startTransition(async () => {
      await revertParaPendenteAction(id);
      router.refresh();
    });
  }

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const d of despesas) if (d.categoria) set.add(d.categoria);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [despesas]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return despesas.filter((d) => {
      if (!mostrarPagas && d.status === "pago") return false;
      if (
        q &&
        !d.descricao.toLowerCase().includes(q) &&
        !(d.client_name ?? "").toLowerCase().includes(q) &&
        !(d.categoria ?? "").toLowerCase().includes(q)
      )
        return false;
      if (categoriaFilter !== "todas" && d.categoria !== categoriaFilter)
        return false;
      return matchesPeriodo(
        parseVencimento(d.data_vencimento),
        periodo,
        dataInicio,
        dataFim
      );
    });
  }, [
    despesas,
    search,
    periodo,
    dataInicio,
    dataFim,
    categoriaFilter,
    mostrarPagas,
  ]);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const totalPendente = filtered
    .filter((d) => d.status === "pendente")
    .reduce((s, d) => s + d.valor, 0);
  const totalPago = filtered
    .filter((d) => d.status === "pago")
    .reduce((s, d) => s + d.valor, 0);
  const qtdAtrasadas = filtered.filter((d) => {
    const v = parseVencimento(d.data_vencimento);
    return d.status === "pendente" && v !== null && v < hoje;
  }).length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Despesas Pendentes
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-amber-600">
            {fmt(totalPendente)}
          </p>
          {qtdAtrasadas > 0 && (
            <p className="mt-0.5 font-body text-xs text-red-600 font-semibold">
              {qtdAtrasadas} vencida{qtdAtrasadas > 1 ? "s" : ""}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Já Pago
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-emerald-700">
            {fmt(totalPago)}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">no período</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar despesa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="flex gap-1 rounded-lg border border-border bg-white p-1 w-fit shadow-sm">
          {(
            [
              { key: "todos", label: "Todos" },
              { key: "mes_atual", label: "Este mês" },
              { key: "personalizado", label: "Personalizado" },
            ] as { key: Periodo; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriodo(key)}
              className={`rounded-md px-3 py-1.5 font-body text-sm transition-colors cursor-pointer ${
                periodo === key
                  ? "bg-primary text-white font-semibold"
                  : "text-muted hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {periodo === "personalizado" && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-primary focus:ring-2 focus:ring-blue-100 cursor-pointer"
            />
            <span className="font-body text-xs text-muted">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-primary focus:ring-2 focus:ring-blue-100 cursor-pointer"
            />
          </div>
        )}

        {categorias.length > 0 && (
          <select
            value={categoriaFilter}
            onChange={(e) => setCategoriaFilter(e.target.value)}
            className="h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none focus:border-primary cursor-pointer"
          >
            <option value="todas">Todas as categorias</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mostrarPagas}
            onChange={(e) => setMostrarPagas(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
          />
          <span className="font-body text-sm text-muted">Mostrar pagas</span>
        </label>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center space-y-3">
            <p className="font-body text-sm text-muted">
              {despesas.filter((d) =>
                !mostrarPagas ? d.status !== "pago" : true
              ).length === 0
                ? "Nenhuma despesa cadastrada"
                : "Nenhuma despesa encontrada para os filtros aplicados"}
            </p>
            {canEdit && (
              <Link
                href="/dashboard/financeiro/novo?tipo=saida"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-body text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                Cadastrar despesa
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted w-[110px]">
                    Vencimento
                  </th>
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Descrição
                  </th>
                  <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Valor
                  </th>
                  <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted w-[260px]">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <DespesaRow
                    key={item.id}
                    item={item}
                    onBaixa={handleBaixa}
                    onDesfazer={handleDesfazer}
                    isPending={isPending}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-slate-50">
                  <td
                    colSpan={2}
                    className="px-4 py-3 font-body text-xs text-muted"
                  >
                    {filtered.length} despesa{filtered.length !== 1 ? "s" : ""}
                  </td>
                  <td className="px-4 py-3 text-right font-body text-sm font-semibold text-amber-700 tabular-nums">
                    {fmt(totalPendente)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
