"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession, type SessionUser } from "./session";
import { hasPermission } from "./permissoes";
import { podeAcessarEntidade } from "./acesso";
import {
  parseChecklist,
  TABELA_CHECKLIST,
  type ChecklistItem,
  type OrigemChecklist,
} from "./checklist-types";

/** Lê a coluna checklist da tabela certa — tabela sempre vem de TABELA_CHECKLIST (literal conhecida), nunca de entrada externa. */
async function lerChecklistRaw(
  tabela: string,
  origemId: string
): Promise<unknown> {
  const [row] =
    tabela === "controles"
      ? await sql`SELECT checklist FROM controles WHERE id = ${origemId}::uuid`
      : tabela === "tarefas_processo"
        ? await sql`SELECT checklist FROM tarefas_processo WHERE id = ${origemId}::uuid`
        : tabela === "clients"
          ? await sql`SELECT checklist FROM clients WHERE id = ${origemId}::uuid`
          : await sql`SELECT checklist FROM processos WHERE id = ${origemId}::uuid`;
  return row?.checklist;
}

async function gravarChecklist(
  tabela: string,
  origemId: string,
  checklistJson: string
): Promise<void> {
  if (tabela === "controles") {
    await sql`UPDATE controles SET checklist = ${checklistJson}::jsonb WHERE id = ${origemId}::uuid`;
  } else if (tabela === "tarefas_processo") {
    await sql`UPDATE tarefas_processo SET checklist = ${checklistJson}::jsonb, updated_at = NOW() WHERE id = ${origemId}::uuid`;
  } else if (tabela === "clients") {
    await sql`UPDATE clients SET checklist = ${checklistJson}::jsonb WHERE id = ${origemId}::uuid`;
  } else {
    await sql`UPDATE processos SET checklist = ${checklistJson}::jsonb WHERE id = ${origemId}::uuid`;
  }
}

/** true se não houver checklist, ou se todos os itens estiverem marcados. */
export async function checklistCompleto(
  origemTipo: OrigemChecklist,
  origemId: string
): Promise<boolean> {
  const tabela = TABELA_CHECKLIST[origemTipo];
  const checklist = parseChecklist(await lerChecklistRaw(tabela, origemId));
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
  if (tabela === "clients") {
    return (
      hasPermission(session, "clientes", "editar") &&
      (await podeAcessarEntidade(session, "cliente", origemId))
    );
  }
  if (tabela === "processos") {
    return (
      hasPermission(session, "processos", "editar") &&
      (await podeAcessarEntidade(session, "processo", origemId))
    );
  }
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

/**
 * Mantém o checklist do Cliente alinhado com os checklists dos processos
 * dele — sem isso, um item desmarcado no checklist de UM processo (ex:
 * "Procuração e contrato assinados" precisa ser renovada pro judicial)
 * não refletia na ficha/lista de Clientes, que continuava mostrando
 * "Completo" mesmo com o processo real mostrando "Faltam N" (achado
 * real: cliente e processo guardam checklists em tabelas separadas).
 * Regra: se todo processo do cliente estiver 100% marcado, o checklist do
 * cliente também fica todo marcado; senão, qualquer item do cliente cujo
 * texto apareça desmarcado em algum processo é desmarcado também — só
 * reflete o que já existe nos processos, nunca inventa pendência nova.
 */
export async function sincronizarChecklistCliente(
  clientId: string
): Promise<void> {
  const processos = await sql`
    SELECT checklist FROM processos
    WHERE client_id = ${clientId}::uuid AND deleted_at IS NULL
  `;
  if (processos.length === 0) return;

  const checklistsProcessos = processos.map((p) => parseChecklist(p.checklist));
  const todosCompletos = checklistsProcessos.every(
    (c) => c.length > 0 && c.every((i) => i.feito)
  );

  const clienteChecklist = parseChecklist(
    await lerChecklistRaw("clients", clientId)
  );
  if (clienteChecklist.length === 0) return;

  let mudou = false;
  const atualizado = clienteChecklist.map((item) => {
    if (todosCompletos) {
      if (!item.feito) mudou = true;
      return { ...item, feito: true };
    }
    const desmarcadoEmAlgumProcesso = checklistsProcessos.some((checklist) =>
      checklist.some((pi) => pi.texto === item.texto && !pi.feito)
    );
    if (desmarcadoEmAlgumProcesso && item.feito) {
      mudou = true;
      return { ...item, feito: false };
    }
    return item;
  });
  if (!mudou) return;

  await gravarChecklist("clients", clientId, JSON.stringify(atualizado));
  revalidatePath("/dashboard/clientes");
  revalidatePath(`/dashboard/clientes/${clientId}`);
}

/** Propaga a mudança pro checklist do cliente logo após editar o checklist de um processo. */
async function sincronizarSeProcesso(
  tabela: string,
  origemId: string
): Promise<void> {
  if (tabela !== "processos") return;
  const [row] =
    await sql`SELECT client_id::text FROM processos WHERE id = ${origemId}::uuid`;
  if (row?.client_id) await sincronizarChecklistCliente(row.client_id);
}

function revalidarChecklist(tabela: string): void {
  if (tabela === "clients") {
    revalidatePath("/dashboard/clientes");
  } else if (tabela === "processos") {
    revalidatePath("/dashboard/processos");
    revalidatePath("/dashboard/producao");
  } else {
    revalidatePath("/dashboard/minhas-tarefas");
    revalidatePath("/dashboard/controles");
  }
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

    const raw = await lerChecklistRaw(tabela, origemId);
    if (raw === undefined) return { error: "Item não encontrado." };

    const checklist = parseChecklist(raw);
    if (index < 0 || index >= checklist.length)
      return { error: "Item de checklist inválido." };
    checklist[index] = { ...checklist[index], feito: !checklist[index].feito };

    await gravarChecklist(tabela, origemId, JSON.stringify(checklist));
    await sincronizarSeProcesso(tabela, origemId);

    revalidarChecklist(tabela);
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
  if (!session) return { error: "Sem permissão." };
  const textoLimpo = texto.trim().slice(0, 200);
  if (!textoLimpo) return { error: "Informe o texto do item." };

  try {
    const tabela = TABELA_CHECKLIST[origemTipo];
    // Mesma checagem por dono do toggleChecklistItemAction — checar só
    // "controles:editar" deixava qualquer Advogado(a)/Estagiário(a) (que tem
    // esse módulo liberado por padrão) adicionar item em checklist de tarefa
    // de processo de outra pessoa, sem ser dono nem ter processos_ver_todos.
    if (!(await podeAlterarChecklist(session, tabela, origemId)))
      return { error: "Sem permissão." };
    const raw = await lerChecklistRaw(tabela, origemId);
    if (raw === undefined) return { error: "Item não encontrado." };

    const checklist = parseChecklist(raw);
    if (checklist.length >= 30)
      return { error: "Limite de 30 itens no checklist." };
    checklist.push({ texto: textoLimpo, feito: false });

    await gravarChecklist(tabela, origemId, JSON.stringify(checklist));
    await sincronizarSeProcesso(tabela, origemId);
    revalidarChecklist(tabela);
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
  if (!session) return { error: "Sem permissão." };

  try {
    const tabela = TABELA_CHECKLIST[origemTipo];
    if (!(await podeAlterarChecklist(session, tabela, origemId)))
      return { error: "Sem permissão." };
    const raw = await lerChecklistRaw(tabela, origemId);
    if (raw === undefined) return { error: "Item não encontrado." };

    const checklist = parseChecklist(raw);
    if (index < 0 || index >= checklist.length)
      return { error: "Item de checklist inválido." };
    checklist.splice(index, 1);

    await gravarChecklist(tabela, origemId, JSON.stringify(checklist));
    await sincronizarSeProcesso(tabela, origemId);
    revalidarChecklist(tabela);
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
  if (!session) return { error: "Sem permissão." };
  const tabelaCheck = TABELA_CHECKLIST[origemTipo];
  if (!(await podeAlterarChecklist(session, tabelaCheck, origemId)))
    return { error: "Sem permissão." };

  const checklist: ChecklistItem[] = itens
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((texto) => ({ texto: texto.slice(0, 200), feito: false }));

  try {
    await gravarChecklist(tabelaCheck, origemId, JSON.stringify(checklist));
    await sincronizarSeProcesso(tabelaCheck, origemId);
    revalidarChecklist(tabelaCheck);
    return {};
  } catch (e) {
    console.error("[checklist] falha ao salvar:", e);
    return { error: "Erro ao salvar checklist." };
  }
}
