"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { definirTeseAtiva } from "./curador-db";

export async function definirTeseAtivaAction(
  teseId: string,
  ativa: boolean
): Promise<{ error?: string }> {
  const session = await getSession();
  if (
    !session ||
    !hasPermission(session, "gerenciador", "ver") ||
    (session.categoria !== "Administrador(a)" &&
      session.categoria !== "Sócio(a)")
  )
    return { error: "Sem permissão." };

  await definirTeseAtiva(teseId, ativa);
  revalidatePath("/dashboard/gerenciador/curador");
  return {};
}
