"use server";
import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession } from "./session";
import { registrarPontosConclusao, reverterPontosConclusao } from "./pontuacao";
import { checklistCompleto } from "./checklist";

export async function darBaixaControleAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };
  // "Minhas Tarefas" é autoatendimento — não exige a permissão ampla de
  // "controles: editar" (que um Colaborador(a) pode nem ter), mas só deixa
  // dar baixa em algo que é seu (ou sem responsável definido).
  const ownerCheck = await sql`
    SELECT c.id FROM controles c
    LEFT JOIN usuarios u ON u.id = c.responsavel_id
    WHERE c.id = ${id}::uuid
      AND (u.login = ${session.login} OR c.responsavel_id IS NULL)
  `;
  if (ownerCheck.length === 0) return { error: "Sem permissão." };
  if (!(await checklistCompleto("controle", id)))
    return { error: "Marque todos os itens do checklist antes de concluir." };
  await sql`UPDATE controles SET status = 'concluido' WHERE id = ${id}::uuid`;
  await registrarPontosConclusao("controle", id);
  revalidatePath("/dashboard/minhas-tarefas");
  revalidatePath("/dashboard");
  return {};
}

export async function darBaixaTarefaAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };

  const ownerCheck = await sql`
    SELECT t.id FROM tarefas_processo t
    LEFT JOIN usuarios u ON u.login = ${session.login}
    LEFT JOIN colaboradores c ON c.id = u.colaborador_id
    WHERE t.id = ${id}::uuid
      AND (t.responsavel = ${session.nome} OR t.responsavel = c.nome)
  `;
  if (ownerCheck.length === 0) return { error: "Sem permissão." };
  if (!(await checklistCompleto("tarefa_processo", id)))
    return { error: "Marque todos os itens do checklist antes de concluir." };

  // Mark tarefa as done
  await sql`UPDATE tarefas_processo SET status = 'Concluída', updated_at = NOW() WHERE id = ${id}::uuid`;
  await registrarPontosConclusao("tarefa_processo", id);

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
  const ownerCheck = await sql`
    SELECT c.id FROM controles c
    LEFT JOIN usuarios u ON u.id = c.responsavel_id
    WHERE c.id = ${id}::uuid
      AND (u.login = ${session.login} OR c.responsavel_id IS NULL)
  `;
  if (ownerCheck.length === 0) return { error: "Sem permissão." };
  await sql`UPDATE controles SET status = NULL WHERE id = ${id}::uuid`;
  await reverterPontosConclusao("controle", id);
  revalidatePath("/dashboard/minhas-tarefas");
  revalidatePath("/dashboard");
  return {};
}

export async function darBaixaCrmTarefaAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };

  const ownerCheck = await sql`
    SELECT t.id FROM crm_tarefas t
    LEFT JOIN usuarios u ON u.login = ${session.login}
    WHERE t.id = ${id}::uuid AND t.responsavel_id = u.colaborador_id
  `;
  if (ownerCheck.length === 0) return { error: "Sem permissão." };

  await sql`UPDATE crm_tarefas SET concluida = TRUE, updated_at = NOW() WHERE id = ${id}::uuid`;
  await registrarPontosConclusao("crm_tarefa", id);
  revalidatePath("/dashboard/minhas-tarefas");
  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard");
  return {};
}

export async function reabrirCrmTarefaAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };

  const ownerCheck = await sql`
    SELECT t.id FROM crm_tarefas t
    LEFT JOIN usuarios u ON u.login = ${session.login}
    WHERE t.id = ${id}::uuid AND t.responsavel_id = u.colaborador_id
  `;
  if (ownerCheck.length === 0) return { error: "Sem permissão." };

  await sql`UPDATE crm_tarefas SET concluida = FALSE, updated_at = NOW() WHERE id = ${id}::uuid`;
  await reverterPontosConclusao("crm_tarefa", id);
  revalidatePath("/dashboard/minhas-tarefas");
  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard");
  return {};
}

export async function reabrirTarefaAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };
  const ownerCheck = await sql`
    SELECT t.id FROM tarefas_processo t
    LEFT JOIN usuarios u ON u.login = ${session.login}
    LEFT JOIN colaboradores c ON c.id = u.colaborador_id
    WHERE t.id = ${id}::uuid
      AND (t.responsavel = ${session.nome} OR t.responsavel = c.nome)
  `;
  if (ownerCheck.length === 0) return { error: "Sem permissão." };
  await sql`UPDATE tarefas_processo SET status = 'Pendente', updated_at = NOW() WHERE id = ${id}::uuid`;
  await reverterPontosConclusao("tarefa_processo", id);
  const rows =
    await sql`SELECT processo_id::text FROM tarefas_processo WHERE id = ${id}::uuid`;
  revalidatePath("/dashboard/minhas-tarefas");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/producao");
  if (rows.length > 0)
    revalidatePath(`/dashboard/processos/${rows[0].processo_id}`);
  return {};
}
