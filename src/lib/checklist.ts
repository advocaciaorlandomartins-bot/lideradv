"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession, type SessionUser } from "./session";
import { hasPermission } from "./permissoes";
import {
  parseChecklist,
  TABELA_CHECKLIST,
  type ChecklistItem,
  type OrigemChecklist,
} from "./checklist-types";

/** true se não houver checklist, ou se todos os itens estiverem marcados. */
export async function checklistCompleto(
  origemTipo: OrigemChecklist,
  origemId: string
): Promise<boolean> {
  const tabela = TABELA_CHECKLIST[origemTipo];
  const [row] =
    tabela === "controles"
      ? await sql`SELECT checklist FROM controles WHERE id = ${origemId}::uuid`
      : await sql`SELECT checklist FROM tarefas_processo WHERE id = ${origemId}::uuid`;
  const checklist = parseChecklist(row?.checklist);
  return checklist.every((i) => i.feito);
}

/**
 * Autoatendimento (mesmo padrão de darBaixaControleAction/darBaixaTarefaAction
 * em minhas-tarefas-actions.ts): quem tem "controles: editar" pode alternar
 * qualquer item (uso na tela de edição do Controle); sem essa permissão
 * ampla — caso comum de Colaborador(a)/Estagiário(a) — só pode alternar
 * itens de algo que é seu, marcado como responsável (uso nos cards de
 * Minhas Tarefas). Sem essa checagem, qualquer usuário autenticado
 * conseguiria marcar/desmarcar checklist de controles/tarefas de outras
 * pessoas só sabendo o UUID.
 */
async function podeAlterarChecklist(
  session: SessionUser,
  tabela: string,
  origemId: string
): Promise<boolean> {
  if (hasPermission(session, "controles", "editar")) return true;
  const ownerCheck =
    tabela === "controles"
      ? await sql`
          SELECT c.id FROM controles c
          LEFT JOIN usuarios u ON u.id = c.responsavel_id
          WHERE c.id = ${origemId}::uuid
            AND (u.login = ${session.login} OR c.responsavel_id IS NULL)
        `
      : await sql`
          SELECT t.id FROM tarefas_processo t
          LEFT JOIN usuarios u ON u.login = ${session.login}
          LEFT JOIN colaboradores col ON col.id = u.colaborador_id
          WHERE t.id = ${origemId}::uuid
            AND (t.responsavel = ${session.nome} OR t.responsavel = col.nome)
        `;
  return ownerCheck.length > 0;
}

export async function toggleChecklistItemAction(
  origemTipo: OrigemChecklist,
  origemId: string,
  index: number
): Promise<{ error?: string; checklist?: ChecklistItem[] }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };

  try {
    const tabela = TABELA_CHECKLIST[origemTipo];
    if (!(await podeAlterarChecklist(session, tabela, origemId)))
      return { error: "Sem permissão." };

    const [row] =
      tabela === "controles"
        ? await sql`SELECT checklist FROM controles WHERE id = ${origemId}::uuid`
        : await sql`SELECT checklist FROM tarefas_processo WHERE id = ${origemId}::uuid`;
    if (!row) return { error: "Item não encontrado." };

    const checklist = parseChecklist(row.checklist);
    if (index < 0 || index >= checklist.length)
      return { error: "Item de checklist inválido." };
    checklist[index] = { ...checklist[index], feito: !checklist[index].feito };

    const checklistJson = JSON.stringify(checklist);
    if (tabela === "controles") {
      await sql`UPDATE controles SET checklist = ${checklistJson}::jsonb WHERE id = ${origemId}::uuid`;
    } else {
      await sql`UPDATE tarefas_processo SET checklist = ${checklistJson}::jsonb, updated_at = NOW() WHERE id = ${origemId}::uuid`;
    }

    revalidatePath("/dashboard/minhas-tarefas");
    revalidatePath("/dashboard/controles");
    return { checklist };
  } catch (e) {
    console.error("[checklist] falha ao alternar item:", e);
    return { error: "Erro ao atualizar checklist." };
  }
}

export async function adicionarChecklistItemAction(
  origemTipo: OrigemChecklist,
  origemId: string,
  texto: string
): Promise<{ error?: string; checklist?: ChecklistItem[] }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "editar"))
    return { error: "Sem permissão." };
  const textoLimpo = texto.trim().slice(0, 200);
  if (!textoLimpo) return { error: "Informe o texto do item." };

  try {
    const tabela = TABELA_CHECKLIST[origemTipo];
    const [row] =
      tabela === "controles"
        ? await sql`SELECT checklist FROM controles WHERE id = ${origemId}::uuid`
        : await sql`SELECT checklist FROM tarefas_processo WHERE id = ${origemId}::uuid`;
    if (!row) return { error: "Item não encontrado." };

    const checklist = parseChecklist(row.checklist);
    if (checklist.length >= 30)
      return { error: "Limite de 30 itens no checklist." };
    checklist.push({ texto: textoLimpo, feito: false });

    const checklistJson = JSON.stringify(checklist);
    if (tabela === "controles") {
      await sql`UPDATE controles SET checklist = ${checklistJson}::jsonb WHERE id = ${origemId}::uuid`;
    } else {
      await sql`UPDATE tarefas_processo SET checklist = ${checklistJson}::jsonb, updated_at = NOW() WHERE id = ${origemId}::uuid`;
    }
    revalidatePath("/dashboard/minhas-tarefas");
    revalidatePath("/dashboard/controles");
    return { checklist };
  } catch (e) {
    console.error("[checklist] falha ao adicionar item:", e);
    return { error: "Erro ao adicionar item." };
  }
}

export async function removerChecklistItemAction(
  origemTipo: OrigemChecklist,
  origemId: string,
  index: number
): Promise<{ error?: string; checklist?: ChecklistItem[] }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "editar"))
    return { error: "Sem permissão." };

  try {
    const tabela = TABELA_CHECKLIST[origemTipo];
    const [row] =
      tabela === "controles"
        ? await sql`SELECT checklist FROM controles WHERE id = ${origemId}::uuid`
        : await sql`SELECT checklist FROM tarefas_processo WHERE id = ${origemId}::uuid`;
    if (!row) return { error: "Item não encontrado." };

    const checklist = parseChecklist(row.checklist);
    if (index < 0 || index >= checklist.length)
      return { error: "Item de checklist inválido." };
    checklist.splice(index, 1);

    const checklistJson = JSON.stringify(checklist);
    if (tabela === "controles") {
      await sql`UPDATE controles SET checklist = ${checklistJson}::jsonb WHERE id = ${origemId}::uuid`;
    } else {
      await sql`UPDATE tarefas_processo SET checklist = ${checklistJson}::jsonb, updated_at = NOW() WHERE id = ${origemId}::uuid`;
    }
    revalidatePath("/dashboard/minhas-tarefas");
    revalidatePath("/dashboard/controles");
    return { checklist };
  } catch (e) {
    console.error("[checklist] falha ao remover item:", e);
    return { error: "Erro ao remover item." };
  }
}

/** Substitui a lista inteira — usado ao criar/editar um controle/tarefa. */
export async function salvarChecklistAction(
  origemTipo: OrigemChecklist,
  origemId: string,
  itens: string[]
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "editar"))
    return { error: "Sem permissão." };

  const checklist: ChecklistItem[] = itens
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((texto) => ({ texto: texto.slice(0, 200), feito: false }));

  try {
    const checklistJson = JSON.stringify(checklist);
    const tabela = TABELA_CHECKLIST[origemTipo];
    if (tabela === "controles") {
      await sql`UPDATE controles SET checklist = ${checklistJson}::jsonb WHERE id = ${origemId}::uuid`;
    } else {
      await sql`UPDATE tarefas_processo SET checklist = ${checklistJson}::jsonb, updated_at = NOW() WHERE id = ${origemId}::uuid`;
    }
    return {};
  } catch (e) {
    console.error("[checklist] falha ao salvar:", e);
    return { error: "Erro ao salvar checklist." };
  }
}
