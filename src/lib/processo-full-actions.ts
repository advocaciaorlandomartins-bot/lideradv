"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";

// ── Fase / Status ──────────────────────────────────────────────

export async function avancarFaseAction(
  processoId: string,
  novaFase: "elaboracao"
): Promise<{ error?: string }> {
  try {
    await sql`
      UPDATE processos SET
        fase_workflow       = ${novaFase},
        fase_elaboracao_at  = NOW(),
        updated_at          = NOW()
      WHERE id = ${processoId}::uuid
    `;
    revalidatePath(`/dashboard/processos/${processoId}`);
    return {};
  } catch {
    return { error: "Erro ao avançar fase." };
  }
}

export async function arquivarProcessoAction(
  processoId: string,
  resultado: string,
  observacao: string
): Promise<{ error?: string }> {
  const notas = observacao.trim() || null;
  try {
    await sql`
      UPDATE processos SET
        fase_workflow      = 'arquivado',
        fase_arquivado_at  = NOW(),
        status             = 'arquivado',
        resultado          = ${resultado || null},
        notas              = COALESCE(${notas}, notas),
        updated_at         = NOW()
      WHERE id = ${processoId}::uuid
    `;
    revalidatePath(`/dashboard/processos/${processoId}`);
    return {};
  } catch {
    return { error: "Erro ao arquivar processo." };
  }
}

// ── Relato ─────────────────────────────────────────────────────

export async function updateRelatoAction(
  processoId: string,
  relato: string
): Promise<{ error?: string }> {
  try {
    await sql`
      UPDATE processos SET relato = ${relato || null}, updated_at = NOW()
      WHERE id = ${processoId}::uuid
    `;
    revalidatePath(`/dashboard/processos/${processoId}`);
    return {};
  } catch {
    return { error: "Erro ao salvar relato." };
  }
}

// ── Responsável ────────────────────────────────────────────────

export async function updateResponsavelAction(
  processoId: string,
  responsavelId: string | null
): Promise<{ error?: string }> {
  try {
    if (responsavelId) {
      await sql`
        UPDATE processos SET responsavel_id = ${responsavelId}::uuid, updated_at = NOW()
        WHERE id = ${processoId}::uuid
      `;
    } else {
      await sql`
        UPDATE processos SET responsavel_id = NULL, updated_at = NOW()
        WHERE id = ${processoId}::uuid
      `;
    }
    revalidatePath(`/dashboard/processos/${processoId}`);
    return {};
  } catch {
    return { error: "Erro ao atualizar responsável." };
  }
}

// ── Histórico / Linha do Tempo ─────────────────────────────────

export async function createHistoricoRegistroAction(data: {
  processoId: string;
  clientId: string;
  texto: string;
  tipo: string;
  dataReferencia: string | null;
  situacao: string | null;
  destaque: boolean;
}): Promise<{ error?: string }> {
  if (!data.texto.trim()) return { error: "O texto é obrigatório." };
  try {
    await sql`
      INSERT INTO historico_registros
        (processo_id, client_id, texto, tipo, data_referencia, situacao, destaque)
      VALUES
        (${data.processoId}::uuid,
         ${data.clientId}::uuid,
         ${data.texto.trim()},
         ${data.tipo},
         ${data.dataReferencia ? data.dataReferencia : null}::date,
         ${data.situacao || null},
         ${data.destaque})
    `;
    revalidatePath(`/dashboard/processos/${data.processoId}`);
    return {};
  } catch {
    return { error: "Erro ao criar registro." };
  }
}

export async function deleteHistoricoRegistroAction(
  id: string,
  processoId: string
): Promise<{ error?: string }> {
  try {
    await sql`DELETE FROM historico_registros WHERE id = ${id}::uuid`;
    revalidatePath(`/dashboard/processos/${processoId}`);
    return {};
  } catch {
    return { error: "Erro ao excluir registro." };
  }
}

// ── Eventos / Controles ────────────────────────────────────────

export async function createEventoControleAction(data: {
  processoId: string;
  titulo: string;
  tipo: string | null;
  data: string | null;
  hora: string | null;
  local: string | null;
  linkVirtual: string | null;
  responsavelId: string | null;
}): Promise<{ error?: string }> {
  if (!data.titulo.trim()) return { error: "O título é obrigatório." };
  try {
    await sql`
      INSERT INTO eventos_controles
        (processo_id, titulo, tipo, data, hora, local, link_virtual, responsavel_id)
      VALUES
        (${data.processoId}::uuid,
         ${data.titulo.trim()},
         ${data.tipo || null},
         ${data.data ? data.data : null}::date,
         ${data.hora ? data.hora : null}::time,
         ${data.local || null},
         ${data.linkVirtual || null},
         ${data.responsavelId ? data.responsavelId : null}::uuid)
    `;
    revalidatePath(`/dashboard/processos/${data.processoId}`);
    return {};
  } catch {
    return { error: "Erro ao criar evento." };
  }
}

export async function deleteEventoControleAction(
  id: string,
  processoId: string
): Promise<{ error?: string }> {
  try {
    await sql`DELETE FROM eventos_controles WHERE id = ${id}::uuid`;
    revalidatePath(`/dashboard/processos/${processoId}`);
    return {};
  } catch {
    return { error: "Erro ao excluir evento." };
  }
}

// ── Tarefas ────────────────────────────────────────────────────

export async function createTarefaProcessoAction(data: {
  processoId: string;
  clientId: string;
  titulo: string;
  responsavel: string | null;
  prioridade: string;
  prazo: string | null;
  hora: string | null;
  comentarios: string | null;
}): Promise<{ error?: string }> {
  if (!data.titulo.trim()) return { error: "O título é obrigatório." };
  try {
    await sql`
      INSERT INTO tarefas_processo
        (processo_id, client_id, titulo, responsavel, prioridade, prazo, hora, comentarios)
      VALUES
        (${data.processoId}::uuid,
         ${data.clientId}::uuid,
         ${data.titulo.trim()},
         ${data.responsavel || null},
         ${data.prioridade},
         ${data.prazo ? data.prazo : null}::date,
         ${data.hora ? data.hora : null}::time,
         ${data.comentarios || null})
    `;
    revalidatePath(`/dashboard/processos/${data.processoId}`);
    return {};
  } catch {
    return { error: "Erro ao criar tarefa." };
  }
}

export async function updateTarefaStatusAction(
  id: string,
  status: string,
  processoId: string
): Promise<{ error?: string }> {
  try {
    await sql`UPDATE tarefas_processo SET status = ${status} WHERE id = ${id}::uuid`;
    revalidatePath(`/dashboard/processos/${processoId}`);
    return {};
  } catch {
    return { error: "Erro ao atualizar tarefa." };
  }
}

export async function deleteTarefaAction(
  id: string,
  processoId: string
): Promise<{ error?: string }> {
  try {
    await sql`DELETE FROM tarefas_processo WHERE id = ${id}::uuid`;
    revalidatePath(`/dashboard/processos/${processoId}`);
    return {};
  } catch {
    return { error: "Erro ao excluir tarefa." };
  }
}

// ── Pendências ─────────────────────────────────────────────────

export async function createPendenciaAction(data: {
  processoId: string;
  clientId: string;
  descricao: string;
}): Promise<{ error?: string }> {
  if (!data.descricao.trim()) return { error: "Descreva a pendência." };
  try {
    await sql`
      INSERT INTO pendencias_cliente (processo_id, client_id, descricao)
      VALUES (${data.processoId}::uuid, ${data.clientId}::uuid, ${data.descricao.trim()})
    `;
    revalidatePath(`/dashboard/processos/${data.processoId}`);
    return {};
  } catch {
    return { error: "Erro ao criar pendência." };
  }
}

export async function updatePendenciaStatusAction(
  id: string,
  status: string,
  processoId: string
): Promise<{ error?: string }> {
  try {
    await sql`UPDATE pendencias_cliente SET status = ${status} WHERE id = ${id}::uuid`;
    revalidatePath(`/dashboard/processos/${processoId}`);
    return {};
  } catch {
    return { error: "Erro ao atualizar pendência." };
  }
}

export async function deletePendenciaAction(
  id: string,
  processoId: string
): Promise<{ error?: string }> {
  try {
    await sql`DELETE FROM pendencias_cliente WHERE id = ${id}::uuid`;
    revalidatePath(`/dashboard/processos/${processoId}`);
    return {};
  } catch {
    return { error: "Erro ao excluir pendência." };
  }
}
