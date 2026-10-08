"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { definirAgentesAtivos } from "./config-agentes-db";

export async function definirAgentesAtivosAction(
  ativo: boolean
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "configuracoes", "editar"))
    return { error: "Sem permissão." };

  await definirAgentesAtivos(ativo, session.id);
  revalidatePath("/dashboard/configuracoes");
  return {};
}
