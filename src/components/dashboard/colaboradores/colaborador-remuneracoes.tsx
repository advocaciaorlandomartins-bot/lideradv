"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markRemuneracaoPagaAction } from "@/lib/remuneracao-actions";
import { TIPO_LABELS, TIPO_COLORS } from "@/lib/remuneracoes-types";
import type { ContaColaborador } from "@/lib/remuneracoes-db";
import { CheckIcon, CurrencyIcon } from "@/components/icons";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatusBadge({ status }: { status: string }) {
  return status === "pago" ? (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[11px] font-semibold bg-emerald-50 text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Pago
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[11px] font-semibold bg-amber-50 text-amber-700">
      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
      Pendente
    </span>
  );
}

interface Props {
  colaboradorId: string;
  conta: ContaColaborador | null;
}

export default function ColaboradorRemuneracoes({
  colaboradorId,
  conta,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleBaixa(id: string) {
    startTransition(async () => {
      await markRemuneracaoPagaAction(id);
      router.refresh();
    });
  }

  const items = conta?.items ?? [];
  const totalPendente = conta?.totalPendente ?? 0;
  const totalPago = conta?.totalPago ?? 0;

  return (
    <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="font-heading text-base font-semibold text-fg">
            Remunerações
          </h2>
          <p className="mt-0.5 font-body text-xs text-muted">
            Salários, comissões, bonificações e adiantamentos
          </p>
        </div>
        <div className="flex items-center gap-4">
          {totalPendente > 0 && (
            <div className="text-right">
              <p className="font-body text-xs text-muted">A pagar</p>
              <p className="font-heading text-base font-semibold text-amber-600">
                {fmt(totalPendente)}
              </p>
            </div>
          )}
          {totalPago > 0 && (
            <div className="text-right">
              <p className="font-body text-xs text-muted">Pago</p>
              <p className="font-heading text-base font-semibold text-emerald-600">
                {fmt(totalPago)}
              </p>
            </div>
          )}
          <Link
            href={`/dashboard/remuneracoes/nova?colaborador=${colaboradorId}`}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-cta px-4 font-body text-sm font-semibold text-white transition-colors duration-150 hover:bg-cta-hover"
          >
            + Lançar
          </Link>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <CurrencyIcon className="h-8 w-8 text-slate-300" />
          <p className="font-body text-sm text-muted">
            Nenhuma remuneração registrada
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                item.status === "pago"
                  ? "border-border bg-slate-50 opacity-75"
                  : "border-amber-100 bg-amber-50/50"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`rounded px-1.5 py-0.5 font-body text-[11px] font-semibold ${TIPO_COLORS[item.tipo]}`}
                  >
                    {TIPO_LABELS[item.tipo]}
                  </span>
                  {item.competencia && (
                    <span className="font-body text-xs text-muted">
                      {item.competencia}
                    </span>
                  )}
                </div>
                {item.descricao && (
                  <p className="mt-0.5 font-body text-xs text-muted truncate max-w-xs">
                    {item.descricao}
                  </p>
                )}
                {item.data_pagamento && (
                  <p className="font-body text-[11px] text-emerald-600">
                    Pago em {item.data_pagamento}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                <StatusBadge status={item.status} />
                <span className="font-body text-sm font-semibold text-fg">
                  {fmt(item.valor)}
                </span>
                {item.status === "pendente" && (
                  <button
                    onClick={() => handleBaixa(item.id)}
                    disabled={isPending}
                    title="Marcar como pago"
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 text-emerald-600 transition-colors duration-150 hover:bg-emerald-50 disabled:opacity-50 cursor-pointer"
                  >
                    <CheckIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
          <p className="font-body text-xs text-muted">
            Total geral:{" "}
            <span className="font-semibold text-fg">
              {fmt(totalPendente + totalPago)}
            </span>
          </p>
          <Link
            href="/dashboard/financeiro?tab=remuneracoes"
            className="font-body text-xs text-primary hover:text-primary-dark transition-colors"
          >
            Ver todos os lançamentos →
          </Link>
        </div>
      )}
    </div>
  );
}
