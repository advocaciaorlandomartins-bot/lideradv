"use client";

import { useTransition } from "react";
import { deleteClientAction } from "@/lib/client-actions";
import { SpinnerIcon } from "@/components/icons";

export default function DeleteClientButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (
      !confirm(
        "Tem certeza que deseja excluir este cliente?\nEsta ação não pode ser desfeita."
      )
    )
      return;
    startTransition(async () => {
      await deleteClientAction(id);
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
