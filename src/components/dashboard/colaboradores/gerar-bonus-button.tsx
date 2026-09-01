"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { gerarBonusMetaAction } from "@/lib/metas-bonus";
import { SpinnerIcon } from "@/components/icons";

export default function GerarBonusButton({
  colaboradorId,
}: {
  colaboradorId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await gerarBonusMetaAction(colaboradorId);
      if (result.error) {
        setError(result.error);
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
        className="flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 font-body text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
      >
        {pending && <SpinnerIcon className="h-4 w-4" />}
        Gerar bônus do mês
      </button>
      {error && (
        <p className="font-body text-xs font-semibold text-red-600">{error}</p>
      )}
    </div>
  );
}
