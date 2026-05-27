"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteModeloAction } from "@/lib/modelo-actions";

interface Props {
  id: string;
  titulo: string;
}

export default function DeleteModeloButton({ id, titulo }: Props) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    if (
      !confirm(
        `Excluir o modelo "${titulo}"?\nEsta ação não pode ser desfeita.`
      )
    )
      return;
    startTransition(async () => {
      await deleteModeloAction(id);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 font-body text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 cursor-pointer"
    >
      {pending ? "…" : "Excluir"}
    </button>
  );
}
