"use client";

import { useState, useTransition } from "react";
import { definirAgentesAtivosAction } from "@/lib/config-agentes-actions";

interface Props {
  ativoInicial: boolean;
}

export default function AgentesIaSection({ ativoInicial }: Props) {
  const [ativo, setAtivo] = useState(ativoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function alternar(novoValor: boolean) {
    setErro(null);
    const anterior = ativo;
    setAtivo(novoValor);
    startTransition(async () => {
      const res = await definirAgentesAtivosAction(novoValor);
      if (res.error) {
        setAtivo(anterior);
        setErro(res.error);
      }
    });
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div
        className={`flex items-center justify-between gap-4 rounded-xl border-2 p-5 transition-colors ${
          ativo ? "border-border bg-white" : "border-amber-300 bg-amber-50"
        }`}
      >
        <div>
          <p className="font-body text-sm font-semibold text-fg">
            Agentes de IA (Dr. Lex, Cérebro Jurídico, Gerar Petição)
          </p>
          <p className="mt-1 font-body text-xs text-muted">
            {ativo
              ? "Ativos — análises, petições e as rotinas automáticas diárias estão funcionando normalmente."
              : "Pausados — todas as chamadas de IA (análises, petições e crons automáticos) estão bloqueadas até reativar."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ativo}
          aria-label="Ativar ou pausar agentes de IA"
          disabled={pending}
          onClick={() => alternar(!ativo)}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60 ${
            ativo ? "bg-primary" : "bg-slate-300"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              ativo ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {erro && (
        <p className="font-body text-sm text-red-600" role="alert">
          {erro}
        </p>
      )}

      <p className="font-body text-xs text-muted">
        Use isto como interruptor de emergência (ex.: custo inesperado,
        comportamento indesejado do modelo). Com os agentes pausados, usuários
        que tentarem gerar petição ou análise recebem um aviso claro em vez de
        erro, e o resumo diário de DOU/INSS por IA também é pulado. Rotinas
        automáticas que não usam IA (publicações, prazos, limpeza, retries de
        WhatsApp) continuam funcionando normalmente.
      </p>
    </div>
  );
}
