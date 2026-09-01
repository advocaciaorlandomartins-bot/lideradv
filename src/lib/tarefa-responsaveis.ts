"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { podeEditarProcesso } from "./processo-ownership";

export async function adicionarResponsavelAction(
  tarefaId: string,
  colaboradorId: string,
  processoId: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "editar"))
    return { error: "Sem permissão." };
  if (!(await podeEditarProcesso(session, processoId)))
    return { error: "Sem permissão." };

  try {
    await sql`
      INSERT INTO tarefa_responsaveis_adicionais (tarefa_id, colaborador_id)
      VALUES (${tarefaId}::uuid, ${colaboradorId}::uuid)
      ON CONFLICT (tarefa_id, colaborador_id) DO NOTHING
    `;
    revalidatePath(`/dashboard/processos/${processoId}`);
    revalidatePath("/dashboard/minhas-tarefas");
    return {};
  } catch (e) {
    console.error("[tarefa-responsaveis] falha ao adicionar:", e);
    return { error: "Erro ao adicionar responsável." };
  }
}

export async function removerResponsavelAction(
  tarefaId: string,
  colaboradorId: string,
  processoId: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "editar"))
    return { error: "Sem permissão." };
  if (!(await podeEditarProcesso(session, processoId)))
    return { error: "Sem permissão." };

  try {
    await sql`
      DELETE FROM tarefa_responsaveis_adicionais
      WHERE tarefa_id = ${tarefaId}::uuid AND colaborador_id = ${colaboradorId}::uuid
    `;
    revalidatePath(`/dashboard/processos/${processoId}`);
    revalidatePath("/dashboard/minhas-tarefas");
    return {};
  } catch (e) {
    console.error("[tarefa-responsaveis] falha ao remover:", e);
    return { error: "Erro ao remover responsável." };
  }
}
