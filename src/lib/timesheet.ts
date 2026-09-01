"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession } from "./session";
import { getColaboradorIdForUser } from "./usuarios-db";
import type { OrigemChecklist as OrigemTimesheet } from "./checklist-types";

export interface TimesheetAtivo {
  id: string;
  origemTipo: OrigemTimesheet;
  origemId: string;
  titulo: string;
  inicio: string;
}

export interface TimesheetEntrada {
  id: string;
  descricao: string | null;
  inicio: string;
  fim: string | null;
  duracaoMin: number | null;
  colaboradorNome: string;
}

/** Timer em andamento (se houver) do usuário logado — no máximo um por vez. */
export async function getTimesheetAtivo(): Promise<TimesheetAtivo | null> {
  const session = await getSession();
  if (!session) return null;
  const colaboradorId = await getColaboradorIdForUser(session.id);
  if (!colaboradorId) return null;

  const [row] = await sql`
    SELECT id::text, origem_tipo, origem_id::text, titulo, inicio::text
    FROM timesheets
    WHERE colaborador_id = ${colaboradorId}::uuid AND fim IS NULL
    ORDER BY inicio DESC
    LIMIT 1
  `;
  if (!row) return null;
  return {
    id: String(row.id),
    origemTipo: row.origem_tipo as OrigemTimesheet,
    origemId: String(row.origem_id),
    titulo: String(row.titulo),
    inicio: String(row.inicio),
  };
}

export async function getTimesheetsPorOrigem(
  origemTipo: OrigemTimesheet,
  origemId: string
): Promise<TimesheetEntrada[]> {
  const session = await getSession();
  if (!session) return [];

  const rows = await sql`
    SELECT ts.id::text, ts.descricao, ts.inicio::text, ts.fim::text,
           ts.duracao_min, col.nome AS colaborador_nome
    FROM timesheets ts
    JOIN colaboradores col ON col.id = ts.colaborador_id
    WHERE ts.origem_tipo = ${origemTipo} AND ts.origem_id = ${origemId}::uuid
    ORDER BY ts.inicio DESC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    descricao: r.descricao ? String(r.descricao) : null,
    inicio: String(r.inicio),
    fim: r.fim ? String(r.fim) : null,
    duracaoMin: r.duracao_min !== null ? Number(r.duracao_min) : null,
    colaboradorNome: String(r.colaborador_nome),
  }));
}

/**
 * Inicia o cronômetro para um item. Se já houver um timer rodando (em
 * qualquer outro item), encerra-o antes — evita timers órfãos rodando
 * indefinidamente quando o usuário esquece de parar e começa outra tarefa.
 */
export async function iniciarTimesheetAction(
  origemTipo: OrigemTimesheet,
  origemId: string,
  titulo: string
): Promise<{ error?: string; id?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };
  const colaboradorId = await getColaboradorIdForUser(session.id);
  if (!colaboradorId)
    return { error: "Usuário não vinculado a um colaborador." };

  try {
    await pararTimersAbertos(colaboradorId);

    const [row] = await sql`
      INSERT INTO timesheets (colaborador_id, origem_tipo, origem_id, titulo, inicio)
      VALUES (${colaboradorId}::uuid, ${origemTipo}, ${origemId}::uuid, ${titulo.slice(0, 255)}, NOW())
      RETURNING id::text
    `;
    revalidatePath("/dashboard/minhas-tarefas");
    revalidatePath("/dashboard/controles");
    revalidatePath(`/dashboard/processos`);
    return { id: String(row.id) };
  } catch (e) {
    console.error("[timesheet] falha ao iniciar:", e);
    return { error: "Erro ao iniciar cronômetro." };
  }
}

export async function pararTimesheetAction(
  id: string,
  descricao?: string | null
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };
  const colaboradorId = await getColaboradorIdForUser(session.id);
  if (!colaboradorId)
    return { error: "Usuário não vinculado a um colaborador." };

  try {
    const [row] = await sql`
      UPDATE timesheets
      SET fim = NOW(),
          duracao_min = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - inicio)) / 60)::int),
          descricao = COALESCE(${descricao || null}, descricao)
      WHERE id = ${id}::uuid AND colaborador_id = ${colaboradorId}::uuid AND fim IS NULL
      RETURNING id::text
    `;
    if (!row) return { error: "Cronômetro não encontrado ou já parado." };
    revalidatePath("/dashboard/minhas-tarefas");
    revalidatePath("/dashboard/controles");
    revalidatePath(`/dashboard/processos`);
    return {};
  } catch (e) {
    console.error("[timesheet] falha ao parar:", e);
    return { error: "Erro ao parar cronômetro." };
  }
}

async function pararTimersAbertos(colaboradorId: string): Promise<void> {
  await sql`
    UPDATE timesheets
    SET fim = NOW(),
        duracao_min = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - inicio)) / 60)::int)
    WHERE colaborador_id = ${colaboradorId}::uuid AND fim IS NULL
  `;
}
