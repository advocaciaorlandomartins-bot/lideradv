"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { podeEditarProcesso } from "./processo-ownership";

export interface ResponsavelAdicional {
  colaboradorId: string;
  nome: string;
}

export async function getResponsaveisAdicionais(
  tarefaId: string
): Promise<ResponsavelAdicional[]> {
  const rows = await sql`
    SELECT col.id::text AS colaborador_id, col.nome
    FROM tarefa_responsaveis_adicionais tra
    JOIN colaboradores col ON col.id = tra.colaborador_id
    WHERE tra.tarefa_id = ${tarefaId}::uuid
    ORDER BY col.nome
  `;
  return rows.map((r) => ({
    colaboradorId: String(r.colaborador_id),
    nome: String(r.nome),
  }));
}

/** Mapa tarefaId → lista de co-responsáveis, para várias tarefas de uma vez. */
export async function getResponsaveisAdicionaisPorProcesso(
  processoId: string
): Promise<Record<string, ResponsavelAdicional[]>> {
  const rows = await sql`
    SELECT tra.tarefa_id::text, col.id::text AS colaborador_id, col.nome
    FROM tarefa_responsaveis_adicionais tra
    JOIN colaboradores col ON col.id = tra.colaborador_id
    JOIN tarefas_processo t ON t.id = tra.tarefa_id
    WHERE t.processo_id = ${processoId}::uuid
    ORDER BY col.nome
  `;
  const map: Record<string, ResponsavelAdicional[]> = {};
  for (const r of rows) {
    const tarefaId = String(r.tarefa_id);
    if (!map[tarefaId]) map[tarefaId] = [];
    map[tarefaId].push({
      colaboradorId: String(r.colaborador_id),
      nome: String(r.nome),
    });
  }
  return map;
}

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
