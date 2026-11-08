"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  markAsPagoAction,
  reagendarLancamentosEmMassaAction,
} from "@/lib/lancamento-actions";
import type { ClientDebito } from "@/lib/lancamentos-db";
import { CheckIcon, BanknotesIcon } from "@/components/icons";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  clientId: string;
  debito: ClientDebito;
  /** Veio da ficha de um processo específico — pré-seleciona esse processo ao criar nova Receita/Despesa. */
  processoId?: string | null;
}

export default function ClientDebitsSection({
  clientId,
  debito,
  processoId = null,
}: Props) {
  const processoQuery = processoId ? `&processo_id=${processoId}` : "";
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Reagendar em massa: só lançamentos pendentes podem ser selecionados —
  // mesma regra de reagendarLancamentosEmMassaAction, que ignora pago/cancelado.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [novaData, setNovaData] = useState("");

  function handleBaixa(id: string) {
    startTransition(async () => {
      const result = await markAsPagoAction(id);
      if (result?.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  function toggleSelect(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(pendentesIds) : new Set());
  }

  function handleReagendarMultiplo() {
    if (!novaData || selectedIds.size === 0) return;
    startTransition(async () => {
      const result = await reagendarLancamentosEmMassaAction(
        Array.from(selectedIds),
        novaData
      );
      if (result?.error) {
        alert(result.error);
        return;
      }
      setSelectedIds(new Set());
      setNovaData("");
      router.refresh();
    });
  }

  // processoId filtra de fato a lista exibida (não só os links de criar
  // novo) — achado de revisão: antes só os botões "+Receita"/"+Despesa"
  // recebiam o processo, a lista continuava mostrando TODOS os
  // lançamentos do cliente mesmo vindo da ficha de um processo
  // específico, contrariando o que o botão "Financeiro" do processo
  // prometia mostrar.
  const itemsFiltrados = processoId
    ? debito.items.filter((i) => i.processo_id === processoId)
    : debito.items;
  const items = itemsFiltrados;
  const totalPendente = processoId
    ? items.reduce((s, i) => (i.status !== "pago" ? s + i.valor : s), 0)
    : debito.totalPendente;
  const totalPago = processoId
    ? items.reduce((s, i) => (i.status === "pago" ? s + i.valor : s), 0)
    : debito.totalPago;
  const pendentesIds = items
    .filter((i) => i.status === "pendente")
    .map((i) => i.id);
  const todasPendentesSelecionadas =
    pendentesIds.length > 0 && pendentesIds.every((id) => selectedIds.has(id));

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-heading text-base font-semibold text-fg">
            Lançamentos do cliente
          </h2>
          <p className="mt-0.5 font-body text-xs text-muted">
            {processoId ? (
              <>
                Mostrando só os lançamentos deste processo —{" "}
                <Link
                  href={`/dashboard/clientes/${clientId}?tab=financeiro`}
                  className="text-primary hover:underline"
                >
                  ver todos do cliente
                </Link>
              </>
            ) : (
              "Receitas e despesas vinculadas"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalPendente > 0 && (
            <div className="text-right mr-2">
              <p className="font-body text-xs text-muted">Pendente</p>
              <p className="font-heading text-base font-semibold text-red-600">
                {fmt(totalPendente)}
              </p>
            </div>
          )}
          {totalPago > 0 && (
            <div className="text-right mr-2">
              <p className="font-body text-xs text-muted">Recebido</p>
              <p className="font-heading text-base font-semibold text-emerald-600">
                {fmt(totalPago)}
              </p>
            </div>
          )}
          <Link
            href={`/dashboard/financeiro/novo?tipo=entrada&client_id=${clientId}${processoQuery}&back=${encodeURIComponent(`/dashboard/clientes/${clientId}?tab=financeiro`)}`}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-emerald-700"
          >
            + Receita
          </Link>
          <Link
            href={`/dashboard/financeiro/novo?tipo=saida&client_id=${clientId}${processoQuery}&back=${encodeURIComponent(`/dashboard/clientes/${clientId}?tab=financeiro`)}`}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-cta px-4 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover"
          >
            + Despesa
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <BanknotesIcon className="h-8 w-8 text-slate-300" />
          <p className="font-body text-sm text-muted">
            {processoId
              ? "Nenhum lançamento deste processo"
              : "Nenhum débito registrado"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {pendentesIds.length > 1 && (
            <label className="flex items-center gap-2 px-1 pb-1 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={todasPendentesSelecionadas}
                onChange={(e) => toggleSelectAll(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <span className="font-body text-xs text-muted">
                Selecionar todos os pendentes
              </span>
            </label>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                item.status === "pago"
                  ? "border-border bg-slate-50 opacity-70"
                  : "border-red-100 bg-red-50/60"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {item.status === "pendente" && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={(e) => toggleSelect(item.id, e.target.checked)}
                    className="h-4 w-4 flex-shrink-0 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`rounded px-1.5 py-0.5 font-body text-[11px] font-semibold ${item.tipo === "entrada" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}
                    >
                      {item.tipo === "entrada" ? "Receita" : "Despesa"}
                    </span>
                    <p className="font-body text-sm font-semibold text-fg truncate">
                      {item.descricao}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {item.categoria && (
                      <span className="font-body text-xs text-muted">
                        {item.categoria}
                      </span>
                    )}
                    {item.data_vencimento && (
                      <span className="font-body text-xs text-muted">
                        Venc.: {item.data_vencimento}
                      </span>
                    )}
                    {item.data_pagamento && (
                      <span className="font-body text-xs text-emerald-600">
                        Pago em {item.data_pagamento}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <span
                  className={`rounded-full px-2 py-0.5 font-body text-[11px] font-semibold ${
                    item.status === "pago"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {item.status === "pago" ? "Ressarcido" : "Pendente"}
                </span>
                <span className="font-body text-sm font-semibold text-fg">
                  {fmt(item.valor)}
                </span>
                {item.status === "pendente" && (
                  <button
                    onClick={() => handleBaixa(item.id)}
                    disabled={isPending}
                    title="Dar baixa"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 text-emerald-600 transition-colors duration-150 hover:bg-emerald-50 disabled:opacity-50 cursor-pointer"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                  </button>
                )}
                <Link
                  href={`/dashboard/financeiro/${item.id}/editar`}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted transition-colors duration-150 hover:border-primary hover:text-primary"
                  title="Editar"
                >
                  <span className="font-body text-xs">✎</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="font-body text-xs text-muted">
            Total geral:{" "}
            <span className="font-semibold text-fg">
              {fmt(totalPendente + totalPago)}
            </span>
          </p>
        </div>
      )}

      {/* Bulk action bar — reagendar vencimento */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 rounded-2xl border border-border bg-white px-5 py-3 shadow-xl">
          <p className="font-body text-sm font-semibold text-fg">
            {selectedIds.size}{" "}
            {selectedIds.size === 1 ? "lançamento" : "lançamentos"} selecionado
            {selectedIds.size > 1 ? "s" : ""}
          </p>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="font-body text-xs text-muted hover:text-fg transition-colors cursor-pointer"
          >
            Limpar
          </button>
          <input
            type="date"
            value={novaData}
            onChange={(e) => setNovaData(e.target.value)}
            className="h-9 rounded-lg border border-border px-2 font-body text-sm text-fg focus:border-primary focus:outline-none"
          />
          <button
            type="button"
            disabled={isPending || !novaData}
            onClick={handleReagendarMultiplo}
            className="rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isPending
              ? "Processando…"
              : `Reagendar ${selectedIds.size} selecionado${selectedIds.size > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
