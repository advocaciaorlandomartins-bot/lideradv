"use client";

import { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { markRemuneracaoPagaAction } from "@/lib/remuneracao-actions";
import { CARGO_LABELS } from "@/lib/colaboradores-types";
import type { CargoColaborador } from "@/lib/colaboradores-types";
import type {
  ContaColaborador,
  ContaColaboradorItem,
} from "@/lib/remuneracoes-db";
import { MagnifyingGlassIcon } from "@/components/icons";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ── StatusBadge ───────────────────────────────────────────────────────────────

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

// ── ColaboradorItemRow ────────────────────────────────────────────────────────

function ColaboradorItemRow({
  item,
  onBaixa,
  isPending,
}: {
  item: ContaColaboradorItem;
  onBaixa: (id: string) => void;
  isPending: boolean;
}) {
  return (
    <tr
      className={`border-b border-border transition-colors ${
        item.status === "pago" ? "bg-slate-50/60 opacity-70" : "bg-white"
      }`}
    >
      <td className="px-4 py-2.5 w-8" />
      <td className="pl-6 pr-4 py-2.5" colSpan={2}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded px-1.5 py-0.5 font-body text-[11px] font-semibold bg-purple-50 text-purple-700 uppercase">
            {item.tipo}
          </span>
          <p className="font-body text-sm text-fg">
            {item.descricao || item.tipo}
          </p>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {item.competencia && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-body text-xs text-muted">
              Competência: {item.competencia}
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
            href={`/dashboard/remuneracoes/${item.id}/editar`}
            className="rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg hover:bg-slate-100 transition-colors"
          >
            Editar
          </Link>
        </div>
      </td>
    </tr>
  );
}

// ── ColaboradorRows ───────────────────────────────────────────────────────────

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
        <td className="px-4 py-3 w-8" />
        <td className="px-4 py-3">
          <p className="font-body font-semibold text-fg">
            {conta.colaborador_nome}
          </p>
          <p className="font-body text-xs text-muted">{cargoLabel}</p>
        </td>
        <td className="px-4 py-3 text-right">
          <span
            className={`font-heading text-base font-semibold ${
              conta.totalPendente > 0 ? "text-amber-600" : "text-muted"
            }`}
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
              className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 font-body text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
            >
              + Nova remuneração
            </Link>
            <Link
              href={`/dashboard/colaboradores/${conta.colaborador_id}`}
              className="rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg hover:bg-slate-100 transition-colors"
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

// ── Main: PagarContent ────────────────────────────────────────────────────────

interface Props {
  contasPagar: ContaColaborador[];
}

export default function PagarContent({ contasPagar }: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBaixa(id: string) {
    startTransition(async () => {
      await markRemuneracaoPagaAction(id);
      router.refresh();
    });
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return contasPagar;
    return contasPagar.filter(
      (c) =>
        c.colaborador_nome.toLowerCase().includes(q) ||
        (
          CARGO_LABELS[c.colaborador_cargo as CargoColaborador] ??
          c.colaborador_cargo
        )
          .toLowerCase()
          .includes(q)
    );
  }, [contasPagar, search]);

  const totalPendente = filtered.reduce((s, c) => s + c.totalPendente, 0);
  const totalPago = filtered.reduce((s, c) => s + c.totalPago, 0);
  const colabPendentes = filtered.filter((c) => c.totalPendente > 0).length;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            A Pagar (equipe)
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-amber-600">
            {fmt(totalPendente)}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">
            {colabPendentes}{" "}
            {colabPendentes === 1 ? "colaborador" : "colaboradores"} pendentes
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Já Pago
          </p>
          <p className="mt-1 font-heading text-2xl font-semibold text-emerald-700">
            {fmt(totalPago)}
          </p>
          <p className="mt-0.5 font-body text-xs text-muted">acumulado</p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5 shadow-sm">
          <p className="font-body text-xs font-semibold uppercase tracking-wide text-muted">
            Acesso rápido
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              href="/dashboard/remuneracoes/nova"
              className="rounded-lg border border-purple-300 bg-purple-50 px-3 py-1.5 font-body text-xs font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
            >
              + Nova remuneração
            </Link>
            <Link
              href="/dashboard/financeiro?tab=remuneracoes"
              className="rounded-lg border border-border px-3 py-1.5 font-body text-xs font-semibold text-fg hover:bg-slate-100 transition-colors"
            >
              Gerenciar remunerações
            </Link>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="search"
            placeholder="Buscar colaborador…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-white pl-9 pr-4 font-body text-sm text-fg placeholder:text-slate-400 outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="font-body text-sm text-muted">
              {search
                ? `Nenhum colaborador encontrado para "${search}"`
                : "Nenhum lançamento a pagar"}
            </p>
            <Link
              href="/dashboard/remuneracoes/nova"
              className="mt-3 inline-block rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 font-body text-sm font-semibold text-purple-700 hover:bg-purple-100 transition-colors"
            >
              + Criar remuneração
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border bg-slate-50">
                  <th className="w-8 px-4 py-3" />
                  <th className="px-4 py-3 text-left font-body text-xs font-semibold uppercase tracking-wide text-muted w-[30%]">
                    Colaborador
                  </th>
                  <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    A Pagar
                  </th>
                  <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted">
                    Pago
                  </th>
                  <th className="px-4 py-3 text-right font-body text-xs font-semibold uppercase tracking-wide text-muted w-[35%]">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((conta) => (
                  <ColaboradorRows
                    key={conta.colaborador_id}
                    conta={conta}
                    isExpanded={expanded.has(conta.colaborador_id)}
                    onToggle={() => toggleExpand(conta.colaborador_id)}
                    onBaixa={handleBaixa}
                    isPending={isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
