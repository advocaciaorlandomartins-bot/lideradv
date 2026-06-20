"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClientAction } from "@/lib/client-actions";
import { SpinnerIcon } from "@/components/icons";

export default function DeleteClientButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function handleDelete() {
    if (
      !confirm(
        "Tem certeza que deseja excluir este cliente?\nEsta ação não pode ser desfeita."
      )
    )
      return;

    setError(null);
    startTransition(async () => {
      const result = await deleteClientAction(id);
      if (result?.error) {
        setError(result.error);
      } else {
        router.push("/dashboard/clientes");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleDelete}
        disabled={isPending}
        className="flex h-9 items-center gap-2 rounded-lg border border-red-200 px-4 font-body text-sm font-semibold text-red-600 transition-colors duration-150 hover:bg-red-50 hover:border-red-300 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
      >
        {isPending ? (
          <>
            <SpinnerIcon className="h-4 w-4" />
            Excluindo…
          </>
        ) : (
          "Excluir"
        )}
      </button>
      {error && <p className="font-body text-xs text-red-600">{error}</p>}
    </div>
  );
}
