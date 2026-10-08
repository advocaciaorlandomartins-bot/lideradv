"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { podeAcessarEntidade } from "./acesso";
import { resolverPontoAtencao } from "./pontos-atencao-db";
import sql from "./db";

export async function resolverPontoAtencaoAction(
  pontoId: string,
  processoId: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "editar"))
    return { error: "Sem permissão." };
  if (!(await podeAcessarEntidade(session, "processo", processoId)))
    return { error: "Sem permissão." };

  const [ponto] = await sql`
    SELECT processo_id::text FROM pontos_atencao WHERE id = ${pontoId}::uuid
  `;
  if (!ponto || ponto.processo_id !== processoId)
    return { error: "Ponto de atenção não encontrado." };

  await resolverPontoAtencao(pontoId, session.id);
  revalidatePath(`/dashboard/processos/${processoId}`);
  return {};
}
