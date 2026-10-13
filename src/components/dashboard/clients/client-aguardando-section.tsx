"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteLancamentoAction } from "@/lib/lancamento-actions";
import type { ClientAguardandoItem } from "@/lib/lancamentos-db";

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Props {
  clientId: string;
  items: ClientAguardandoItem[];
}

/**
 * Lançamentos "aguardando resultado" (honorários de êxito sem data
 * prevista de pagamento) ficam fora dos totais da aba Financeiro do
 * cliente de propósito — mas sem nenhuma seção própria, ficavam
 * completamente invisíveis aqui, só apareciam no painel Financeiro
 * geral. Isso já gerou lançamento duplicado sem o Orlando perceber
 * (a tela do cliente mostrava "Nenhum débito registrado" mesmo já
 * tendo um aguardando resultado). Esta seção existe só pra visibilidade
 * — não soma em Pago/Pendente/Total geral.
 */
export default function ClientAguardandoSection({ clientId, items }: Props) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) return null;

  function handleDelete(id: string) {
    if (!confirm("Excluir este lançamento aguardando resultado?")) return;
    setDeletingId(id);
    startTransition(async () => {
      const result = await deleteLancamentoAction(id);
      setDeletingId(null);
      if (result?.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50/60 shadow-sm">
      <div className="flex items-center justify-between border-b border-amber-200 bg-amber-100/60 px-4 py-3">
        <div>
          <h2 className="font-heading text-sm font-bold text-amber-900">
            Aguardando resultado
          </h2>
          <p className="font-body text-[11px] text-amber-700">
            Sem data prevista de pagamento — não entra nos totais acima
          </p>
        </div>
        <span className="rounded-full bg-amber-200 px-2 py-0.5 font-body text-[11px] font-bold text-amber-800">
          {items.length}
        </span>
      </div>

      <div className="divide-y divide-amber-100">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`rounded px-1.5 py-0.5 font-body text-[11px] font-semibold ${item.tipo === "entrada" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"}`}
                >
                  {item.tipo === "entrada" ? "Receita" : "Despesa"}
                </span>
                <p className="truncate font-body text-sm font-semibold text-fg">
                  {item.descricao}
                </p>
              </div>
              {item.categoria && (
                <p className="font-body text-xs text-muted">{item.categoria}</p>
              )}
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <span className="font-body text-sm font-semibold text-amber-900 tabular-nums">
                {fmt(item.valor)}
              </span>
              <Link
                href={`/dashboard/financeiro/novo?tipo=entrada&client_id=${clientId}${item.processo_id ? `&processo_id=${item.processo_id}` : ""}&cancel_aguardando=${item.id}&valor_inicial=${item.valor}&back=${encodeURIComponent(`/dashboard/clientes/${clientId}?tab=financeiro`)}`}
                title="O resultado (judicial/administrativo) saiu — defina o valor final e a forma de pagamento"
                className="rounded border border-emerald-500 bg-emerald-50 px-2.5 py-1 font-body text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Registrar resultado
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                disabled={isPending && deletingId === item.id}
                className="rounded border border-red-200 bg-white px-2.5 py-1 font-body text-[11px] text-red-500 hover:bg-red-50 disabled:opacity-40 cursor-pointer"
              >
                {isPending && deletingId === item.id ? "…" : "Excluir"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
