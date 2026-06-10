"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gerarResumoIaAction } from "@/lib/publicacoes-actions";
import { SparklesIcon, SpinnerIcon } from "@/components/icons";

export default function ResumoIaButton({ pubId }: { pubId: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [erro, setErro] = useState("");

  function handleGerar() {
    setErro("");
    startTransition(async () => {
      const res = await gerarResumoIaAction(pubId);
      if (res.ok) {
        router.refresh();
      } else {
        setErro(res.mensagem);
      }
    });
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <button
        onClick={handleGerar}
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-body text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? (
          <SpinnerIcon className="h-4 w-4 animate-spin" />
        ) : (
          <SparklesIcon className="h-4 w-4" />
        )}
        {isPending ? "Analisando com IA..." : "Gerar Resumo"}
      </button>
      {erro && (
        <p className="font-body text-xs font-semibold text-red-600">
          ❌ {erro}
        </p>
      )}
    </div>
  );
}
