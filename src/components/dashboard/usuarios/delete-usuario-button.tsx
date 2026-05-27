"use client";

import { useTransition } from "react";
import { deleteUsuarioAction } from "@/lib/usuarios-actions";

interface Props {
  id: string;
  login: string;
}

export default function DeleteUsuarioButton({ id, login }: Props) {
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (
      !confirm(`Excluir o usuário "${login}"? Esta ação não pode ser desfeita.`)
    )
      return;
    startTransition(async () => {
      await deleteUsuarioAction(id);
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="rounded-lg border border-red-200 px-3 h-8 font-body text-xs font-semibold text-red-600 flex items-center hover:bg-red-50 hover:border-red-400 transition-colors disabled:opacity-50 cursor-pointer"
    >
      {pending ? "…" : "Excluir"}
    </button>
  );
}
