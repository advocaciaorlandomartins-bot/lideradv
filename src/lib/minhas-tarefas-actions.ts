"use server";
import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession } from "./session";

export async function darBaixaControleAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };
  await sql`UPDATE controles SET status = 'concluido' WHERE id = ${id}::uuid`;
  revalidatePath("/dashboard/minhas-tarefas");
  revalidatePath("/dashboard");
  return {};
}

export async function darBaixaTarefaAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };

  // Mark tarefa as done
  await sql`UPDATE tarefas_processo SET status = 'Concluída' WHERE id = ${id}::uuid`;

  // Check if all pending tasks for this processo are now done — auto-advance analise→producao
  const tarefaRows = await sql`
    SELECT t.processo_id::text, p.estagio_producao
    FROM tarefas_processo t
    JOIN processos p ON p.id = t.processo_id
    WHERE t.id = ${id}::uuid
  `;
  if (tarefaRows.length > 0) {
    const { processo_id, estagio_producao } = tarefaRows[0];
    if (estagio_producao === "analise") {
      const remaining = await sql`
        SELECT COUNT(*)::int AS n FROM tarefas_processo
        WHERE processo_id = ${processo_id}::uuid
          AND status IN ('Pendente', 'Em andamento')
      `;
      if (Number(remaining[0]?.n ?? 1) === 0) {
        await sql`
          UPDATE processos
          SET estagio_producao = 'producao', data_estagio_at = NOW()
          WHERE id = ${processo_id}::uuid
        `;
      }
    }
  }

  revalidatePath("/dashboard/minhas-tarefas");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/producao");
  if (tarefaRows.length > 0) {
    revalidatePath(`/dashboard/processos/${tarefaRows[0].processo_id}`);
  }
  return {};
}

export async function reabrirControleAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };
  await sql`UPDATE controles SET status = NULL WHERE id = ${id}::uuid`;
  revalidatePath("/dashboard/minhas-tarefas");
  revalidatePath("/dashboard");
  return {};
}

export async function reabrirTarefaAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };
  await sql`UPDATE tarefas_processo SET status = 'Pendente' WHERE id = ${id}::uuid`;
  const rows =
    await sql`SELECT processo_id::text FROM tarefas_processo WHERE id = ${id}::uuid`;
  revalidatePath("/dashboard/minhas-tarefas");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/producao");
  if (rows.length > 0)
    revalidatePath(`/dashboard/processos/${rows[0].processo_id}`);
  return {};
}
