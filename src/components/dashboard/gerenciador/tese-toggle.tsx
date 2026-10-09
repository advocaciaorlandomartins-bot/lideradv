"use client";

import { useState, useTransition } from "react";
import { definirTeseAtivaAction } from "@/lib/curador-actions";

export default function TeseToggle({
  teseId,
  ativaInicial,
}: {
  teseId: string;
  ativaInicial: boolean;
}) {
  const [ativa, setAtiva] = useState(ativaInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function alternar() {
    setErro(null);
    const anterior = ativa;
    const novo = !ativa;
    setAtiva(novo);
    startTransition(async () => {
      const res = await definirTeseAtivaAction(teseId, novo);
      if (res.error) {
        setAtiva(anterior);
        setErro(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={alternar}
        disabled={pending}
        className={`rounded-full px-3 py-1 font-body text-xs font-semibold transition-colors cursor-pointer disabled:cursor-wait disabled:opacity-60 ${
          ativa
            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
        }`}
      >
        {ativa ? "Ativa — usada em petições" : "Desativada"}
      </button>
      {erro && <p className="font-body text-xs text-red-600">{erro}</p>}
    </div>
  );
}
