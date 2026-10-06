"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { enviarContratoParceriaAction } from "@/lib/contrato-parceria-actions";
import { SpinnerIcon } from "@/components/icons";

export default function EnviarContratoParceriaButton({
  colaboradorId,
  colaboradorNome,
}: {
  colaboradorId: string;
  colaboradorNome: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    if (
      !confirm(
        `Enviar o Contrato de Parceria pra ${colaboradorNome} assinar digitalmente? O percentual de comissão atual do cadastro vai pro contrato.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await enviarContratoParceriaAction(colaboradorId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.envelopeId) {
        router.push(`/dashboard/assinaturas/${result.envelopeId}`);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={pending}
        className="flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-4 font-body text-sm font-semibold text-white transition-colors hover:bg-violet-700 disabled:opacity-60"
      >
        {pending && <SpinnerIcon className="h-4 w-4" />}
        Enviar Contrato de Parceria
      </button>
      {error && (
        <p className="max-w-xs text-right font-body text-xs font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
