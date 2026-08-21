"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteColaboradorAction } from "@/lib/colaborador-actions";
import { SpinnerIcon } from "@/components/icons";

export default function DeleteColaboradorButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (
      !confirm(
        "Tem certeza que deseja excluir este colaborador?\nEsta ação não pode ser desfeita."
      )
    )
      return;
    // Botão fica na página de detalhe — depois de excluir, navega pra lista
    // em vez de só dar refresh (que tentaria recarregar um registro apagado).
    startTransition(async () => {
      await deleteColaboradorAction(id);
      router.push("/dashboard/colaboradores");
    });
  }

  return (
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
  );
}
