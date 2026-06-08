"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markAsPagoAction } from "@/lib/lancamento-actions";
import { markRemuneracaoPagaAction } from "@/lib/remuneracao-actions";
import { TIPO_LABELS, TIPO_COLORS } from "@/lib/remuneracoes-types";
import { CARGO_LABELS } from "@/lib/colaboradores-types";
import type { CargoColaborador } from "@/lib/colaboradores-types";
import type { ContaCliente, ContaClienteItem } from "@/lib/lancamentos-db";
import type {
  ContaColaborador,
  ContaColaboradorItem,
} from "@/lib/remuneracoes-db";
import { MagnifyingGlassIcon } from "@/components/icons";

type Periodo = "todos" | "mes_atual" | "personalizado";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Parse "DD/MM/YYYY" → Date
function parseVencimento(s: string | null): Date | null {
  if (!s) return null;
  const p = s.split("/");
  if (p.length !== 3) return null;
  return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
}

// Parse "MM/YYYY" → first day of that month
function parseCompetencia(s: string | null): Date | null {
  if (!s) return null;
  const p = s.split("/");
  if (p.length !== 2) return null;
  return new Date(Number(p[1]), Number(p[0]) - 1, 1);
}

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
  if (periodo === "personalizado") {
    if (inicio && d < new Date(inicio + "T00:00:00")) return false;
    if (fim && d > new Date(fim + "T23:59:59")) return false;
    return true;
  }
  return true;
}

interface Props {
  contasReceber: ContaCliente[];
  contasPagar: ContaColaborador[];
}

export default function ContasContent({ contasReceber, contasPagar }: Props) {
  const router = useRouter();
  const [subTab, setSubTab] = useState<"receber" | "pagar">("receber");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  // Filters
  const [search, setSearch] = useState("");
  const [periodo, setPeriodo] = useState<Periodo>("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBaixaLancamento(id: string) {
    startTransition(async () => {
      await markAsPagoAction(id);
      router.refresh();
    });
  }

  function handleBaixaRemuneracao(id: string) {
    startTransition(async () => {
      await markRemuneracaoPagaAction(id);
      router.refresh();
    });
  }

  const filteredReceber = useMemo(() => {
    const q = search.toLowerCase().trim();
    return contasReceber
      .filter(
        (c) =>
          !q ||
          c.client_name.toLowerCase().includes(q) ||
          c.client_doc.replace(/\D/g, "").includes(q.replace(/\D/g, ""))
      )
      .map((c) => {
        const items =
          periodo === "todos"
            ? c.items
            : c.items.filter((item) =>
                matchesPeriodo(
                  parseVencimento(item.data_vencimento),
                  periodo,
                  dataInicio,
                  dataFim
                )
              );
        return {
          ...c,
          items,
          totalPendente: items
            .filter((i) => i.status !== "pago")
            .reduce((s, i) => s + i.valor, 0),
          totalPago: items
            .filter((i) => i.status === "pago")
            .reduce((s, i) => s + i.valor, 0),
        };
      })
      .filter((c) => periodo === "todos" || c.items.length > 0);
  }, [contasReceber, search, periodo, dataInicio, dataFim]);

  const filteredPagar = useMemo(() => {
    const q = search.toLowerCase().trim();
    return contasPagar
      .filter(
        (c) =>
          !q ||
          c.colaborador_nome.toLowerCase().includes(q) ||
          (
            CARGO_LABELS[c.colaborador_cargo as CargoColaborador] ??
            c.colaborador_cargo
          )
            .toLowerCase()
            .includes(q)
      )
      .map((c) => {
        const items =
          periodo === "todos"
            ? c.items
            : c.items.filter((item) =>
                matchesPeriodo(
                  parseCompetencia(item.competencia),
                  periodo,
                  dataInicio,
                  dataFim
                )
              );
        return {
          ...c,
          items,
          totalPendente: items
            .filter((i) => i.status !== "pago")
            .reduce((s, i) => s + i.valor, 0),
          totalPago: items
            .filter((i) => i.status === "pago")
            .reduce((s, i) => s + i.valor, 0),
        };
      })
      .filter((c) => periodo === "todos" || c.items.length > 0);
  }, [contasPagar, search, periodo, dataInicio, dataFim]);

  const totalACobrar = filteredReceber.reduce((s, c) => s + c.totalPendente, 0);
  const totalAPagar = filteredPagar.reduce((s, c) => s + c.totalPendente, 0);
  const saldo = totalACobrar - totalAPagar;

  const clientesPendentes = filteredReceber.filter(
    (c) => c.totalPendente > 0
  ).length;
  const colabPendentes = filteredPagar.filter(
    (c) => c.totalPendente > 0
  ).length;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          onClick={() => setSubTab("receber")}
          className={`rounded-xl border bg-white p-5 shadow-sm text-left transition-all duration-150 cursor-pointer hover:shadow-md ${
            subTab === "receber"
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-primary/40"
          }`}
        >
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Total a Cobrar
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-red-600">
            {fmt(totalACobrar)}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">
            {clientesPendentes}{" "}
            {clientesPendentes === 1 ? "cliente" : "clientes"} com saldo
          </p>
        </button>

        <button
          onClick={() => setSubTab("pagar")}
          className={`rounded-xl border bg-white p-5 shadow-sm text-left transition-all duration-150 cursor-pointer hover:shadow-md ${
            subTab === "pagar"
              ? "border-primary ring-2 ring-primary/20"
              : "border-border hover:border-primary/40"
          }`}
        >
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Total a Pagar
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-amber-600">
            {fmt(totalAPagar)}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">
            {colabPendentes}{" "}
            {colabPendentes === 1 ? "colaborador" : "colaboradores"} pendentes
          </p>
        </button>

        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Saldo
          </p>
          <p
            className={`mt-1 font-heading text-2xl font-semibold ${saldo >= 0 ? "text-emerald-700" : "text-red-600"}`}
          >
            {fmt(saldo)}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">
            A cobrar − a pagar
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="search"
            placeholder={
              subTab === "receber" ? "Buscar cliente…" : "Buscar colaborador…"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Period filter */}
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
              className={`rounded-md px-3 py-1.5 font-body text-sm transition-colors duration-150 cursor-pointer ${
                periodo === key
                  ? "bg-primary text-white font-semibold"
                  : "text-muted hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom date pickers */}
        {periodo === "personalizado" && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 cursor-pointer"
            />
            <span className="font-body text-xs text-muted">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-fg outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100 cursor-pointer"
            />
            {(dataInicio || dataFim) && (
              <button
                type="button"
                onClick={() => {
                  setDataInicio("");
                  setDataFim("");
                }}
                className="h-10 rounded-lg border border-border bg-white px-3 font-body text-sm text-muted hover:text-fg transition-colors cursor-pointer"
              >
                Limpar datas
              </button>
            )}
          </div>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 rounded-xl border border-border bg-white p-1 w-fit shadow-sm">
        <button
          type="button"
          onClick={() => setSubTab("receber")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-body text-sm font-semibold transition-colors duration-150 ${
            subTab === "receber"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-fg"
          }`}
        >
          A Cobrar — Clientes
          {clientesPendentes > 0 && (
            <span
              className={`rounded-full px-1.5 font-body text-[11px] font-bold ${subTab === "receber" ? "bg-white/20 text-white" : "bg-red-100 text-red-700"}`}
            >
              {clientesPendentes}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSubTab("pagar")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-body text-sm font-semibold transition-colors duration-150 ${
            subTab === "pagar"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-fg"
          }`}
        >
          A Pagar — Colaboradores
          {colabPendentes > 0 && (
            <span
              className={`rounded-full px-1.5 font-body text-[11px] font-bold ${subTab === "pagar" ? "bg-white/20 text-white" : "bg-amber-100 text-amber-700"}`}
            >
              {colabPendentes}
            </span>
          )}
        </button>
      </div>

      {/* A Cobrar */}
      {subTab === "receber" && (
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          {filteredReceber.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="font-body text-sm text-muted">
                {search
                  ? `Nenhum cliente encontrado para "${search}"`
                  : periodo !== "todos"
                    ? "Nenhuma despesa neste período"
                    : "Nenhuma despesa vinculada a clientes"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50">
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted w-[35%]">
                      Cliente
                    </th>
                    <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      A Cobrar
                    </th>
                    <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Recebido
                    </th>
                    <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted w-[30%]">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceber.map((conta) => (
                    <ClienteRows
                      key={conta.client_id}
                      conta={conta}
                      isExpanded={expanded.has(conta.client_id)}
                      onToggle={() => toggleExpand(conta.client_id)}
                      onBaixa={handleBaixaLancamento}
                      isPending={isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* A Pagar */}
      {subTab === "pagar" && (
        <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
          {filteredPagar.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="font-body text-sm text-muted">
                {search
                  ? `Nenhum colaborador encontrado para "${search}"`
                  : periodo !== "todos"
                    ? "Nenhuma remuneração neste período"
                    : "Nenhuma remuneração pendente"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-slate-50">
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Colaborador
                    </th>
                    <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Cargo
                    </th>
                    <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      A Pagar
                    </th>
                    <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Pago
                    </th>
                    <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPagar.map((conta) => (
                    <ColaboradorRows
                      key={conta.colaborador_id}
                      conta={conta}
                      isExpanded={expanded.has(conta.colaborador_id)}
                      onToggle={() => toggleExpand(conta.colaborador_id)}
                      onBaixa={handleBaixaRemuneracao}
                      isPending={isPending}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── A Cobrar rows ─────────────────────────────────────────────────────────────

function ClienteRows({
  conta,
  isExpanded,
  onToggle,
  onBaixa,
  isPending,
}: {
  conta: ContaCliente;
  isExpanded: boolean;
  onToggle: () => void;
  onBaixa: (id: string) => void;
  isPending: boolean;
}) {
  return (
    <>
      <tr className="border-b border-border hover:bg-slate-50 transition-colors">
        <td className="px-4 py-3">
          <p className="font-body font-semibold text-fg">{conta.client_name}</p>
          <p className="font-body text-xs text-muted">{conta.client_doc}</p>
        </td>
        <td className="px-4 py-3 text-right">
          <span
            className={`font-heading text-base font-semibold ${conta.totalPendente > 0 ? "text-red-600" : "text-muted"}`}
          >
            {fmt(conta.totalPendente)}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="font-body font-semibold text-emerald-700">
            {fmt(conta.totalPago)}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {isExpanded ? "Recolher ▲" : `Expandir (${conta.items.length}) ▼`}
            </button>
            <Link
              href={`/dashboard/financeiro/novo?tipo=saida&client_id=${conta.client_id}`}
              className="rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg hover:bg-slate-100 transition-colors"
            >
              + Despesa
            </Link>
            <Link
              href={`/dashboard/clientes/${conta.client_id}`}
              className="rounded-lg border border-primary/30 px-3 py-1.5 font-body text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
            >
              Ver cliente
            </Link>
          </div>
        </td>
      </tr>
      {isExpanded &&
        conta.items.map((item) => (
          <ClienteItemRow
            key={item.id}
            item={item}
            onBaixa={onBaixa}
            isPending={isPending}
          />
        ))}
    </>
  );
}

function ClienteItemRow({
  item,
  onBaixa,
  isPending,
}: {
  item: ContaClienteItem;
  onBaixa: (id: string) => void;
  isPending: boolean;
}) {
  return (
    <tr
      className={`border-b border-border transition-colors ${item.status === "pago" ? "bg-slate-50/60 opacity-70" : "bg-red-50/30"}`}
    >
      <td className="pl-10 pr-4 py-2.5" colSpan={2}>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`rounded px-1.5 py-0.5 font-body text-[11px] font-semibold ${item.tipo === "entrada" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}
          >
            {item.tipo === "entrada" ? "Receita" : "Despesa"}
          </span>
          <p className="font-body text-sm text-fg">{item.descricao}</p>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {item.categoria && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-body text-xs text-muted">
              {item.categoria}
            </span>
          )}
          {item.data_vencimento && (
            <span className="font-body text-xs text-muted">
              Venc. {item.data_vencimento}
            </span>
          )}
          {item.data_pagamento && (
            <span className="font-body text-xs text-emerald-600">
              Pago em {item.data_pagamento}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="font-body text-sm font-semibold text-fg">
          {fmt(item.valor)}
        </span>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <StatusBadge status={item.status} />
          {item.status !== "pago" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onBaixa(item.id)}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-body text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Dar baixa
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

// ── A Pagar rows ──────────────────────────────────────────────────────────────

function ColaboradorRows({
  conta,
  isExpanded,
  onToggle,
  onBaixa,
  isPending,
}: {
  conta: ContaColaborador;
  isExpanded: boolean;
  onToggle: () => void;
  onBaixa: (id: string) => void;
  isPending: boolean;
}) {
  const cargoLabel =
    CARGO_LABELS[conta.colaborador_cargo as CargoColaborador] ??
    conta.colaborador_cargo;

  return (
    <>
      <tr className="border-b border-border hover:bg-slate-50 transition-colors">
        <td className="px-4 py-3">
          <p className="font-body font-semibold text-fg">
            {conta.colaborador_nome}
          </p>
        </td>
        <td className="px-4 py-3">
          <span className="font-body text-sm text-muted">{cargoLabel}</span>
        </td>
        <td className="px-4 py-3 text-right">
          <span
            className={`font-heading text-base font-semibold ${conta.totalPendente > 0 ? "text-amber-600" : "text-muted"}`}
          >
            {fmt(conta.totalPendente)}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <span className="font-body font-semibold text-emerald-700">
            {fmt(conta.totalPago)}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {isExpanded ? "Recolher ▲" : `Expandir (${conta.items.length}) ▼`}
            </button>
            <Link
              href={`/dashboard/remuneracoes/nova?colaborador=${conta.colaborador_id}`}
              className="rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg hover:bg-slate-100 transition-colors"
            >
              + Remuneração
            </Link>
            <Link
              href={`/dashboard/colaboradores/${conta.colaborador_id}`}
              className="rounded-lg border border-primary/30 px-3 py-1.5 font-body text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
            >
              Ver colaborador
            </Link>
          </div>
        </td>
      </tr>
      {isExpanded &&
        conta.items.map((item) => (
          <ColaboradorItemRow
            key={item.id}
            item={item}
            onBaixa={onBaixa}
            isPending={isPending}
          />
        ))}
    </>
  );
}

function ColaboradorItemRow({
  item,
  onBaixa,
  isPending,
}: {
  item: ContaColaboradorItem;
  onBaixa: (id: string) => void;
  isPending: boolean;
}) {
  const tipoLabel = TIPO_LABELS[item.tipo] ?? item.tipo;
  const tipoColor = TIPO_COLORS[item.tipo] ?? "bg-slate-100 text-slate-700";

  return (
    <tr
      className={`border-b border-border transition-colors ${item.status === "pago" ? "bg-slate-50/60 opacity-70" : "bg-amber-50/30"}`}
    >
      <td className="pl-10 pr-4 py-2.5" colSpan={2}>
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`rounded-full px-2 py-0.5 font-body text-xs font-semibold ${tipoColor}`}
          >
            {tipoLabel}
          </span>
          {item.descricao && (
            <span className="font-body text-sm text-muted">
              {item.descricao}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {item.competencia && (
            <span className="font-body text-xs text-muted">
              Comp. {item.competencia}
            </span>
          )}
          {item.data_pagamento && (
            <span className="font-body text-xs text-emerald-600">
              Pago em {item.data_pagamento}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="font-body text-sm font-semibold text-fg">
          {fmt(item.valor)}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right" />
      <td className="px-4 py-2.5">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          <StatusBadge status={item.status} />
          {item.status !== "pago" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => onBaixa(item.id)}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 font-body text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Dar baixa
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Shared ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "pago"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-amber-50 text-amber-700";
  const label = status === "pago" ? "Pago" : "Pendente";
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-body text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}
