"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { logAction } from "./audit";

export type CrmFormState = { error?: string; success?: boolean } | null;

// ── Leads ─────────────────────────────────────────────────────────────────────

export async function createLeadAction(
  _prev: CrmFormState,
  formData: FormData
): Promise<CrmFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "criar"))
    return { error: "Sem permissão." };

  const nome = ((formData.get("nome") as string) ?? "").trim();
  const email = ((formData.get("email") as string) ?? "").trim() || null;
  const telefone = ((formData.get("telefone") as string) ?? "").trim() || null;
  const tipo = ((formData.get("tipo") as string) ?? "PF").trim();
  const empresa = ((formData.get("empresa") as string) ?? "").trim() || null;
  const areaInteresse =
    ((formData.get("area_interesse") as string) ?? "").trim() || null;
  const estagio = (
    (formData.get("estagio") as string) ?? "novo_contato"
  ).trim();
  const origem = ((formData.get("origem") as string) ?? "").trim() || null;
  const responsavelId =
    ((formData.get("responsavel_id") as string) ?? "").trim() || null;
  const notas = ((formData.get("notas") as string) ?? "").trim() || null;

  if (!nome) return { error: "Nome é obrigatório." };

  try {
    if (responsavelId) {
      await sql`
        INSERT INTO crm_leads (nome, email, telefone, tipo, empresa, area_interesse, estagio, origem, responsavel_id, notas)
        VALUES (${nome}, ${email}, ${telefone}, ${tipo}, ${empresa}, ${areaInteresse}, ${estagio}, ${origem}, ${responsavelId}::uuid, ${notas})
      `;
    } else {
      await sql`
        INSERT INTO crm_leads (nome, email, telefone, tipo, empresa, area_interesse, estagio, origem, notas)
        VALUES (${nome}, ${email}, ${telefone}, ${tipo}, ${empresa}, ${areaInteresse}, ${estagio}, ${origem}, ${notas})
      `;
    }
  } catch (err) {
    console.error("createLeadAction:", err);
    return { error: "Erro ao criar lead." };
  }

  await logAction({
    acao: "criar",
    entidade: "lead",
    descricao: `Criou lead: ${nome}`,
  });
  revalidatePath("/dashboard/crm");
  return { success: true };
}

export async function updateLeadAction(
  _prev: CrmFormState,
  formData: FormData
): Promise<CrmFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "editar"))
    return { error: "Sem permissão." };

  const id = ((formData.get("id") as string) ?? "").trim();
  const nome = ((formData.get("nome") as string) ?? "").trim();
  const email = ((formData.get("email") as string) ?? "").trim() || null;
  const telefone = ((formData.get("telefone") as string) ?? "").trim() || null;
  const tipo = ((formData.get("tipo") as string) ?? "PF").trim();
  const empresa = ((formData.get("empresa") as string) ?? "").trim() || null;
  const areaInteresse =
    ((formData.get("area_interesse") as string) ?? "").trim() || null;
  const estagio = (
    (formData.get("estagio") as string) ?? "novo_contato"
  ).trim();
  const origem = ((formData.get("origem") as string) ?? "").trim() || null;
  const responsavelId =
    ((formData.get("responsavel_id") as string) ?? "").trim() || null;
  const notas = ((formData.get("notas") as string) ?? "").trim() || null;

  if (!id) return { error: "ID inválido." };
  if (!nome) return { error: "Nome é obrigatório." };

  try {
    if (responsavelId) {
      await sql`
        UPDATE crm_leads SET
          nome = ${nome}, email = ${email}, telefone = ${telefone}, tipo = ${tipo},
          empresa = ${empresa}, area_interesse = ${areaInteresse}, estagio = ${estagio},
          origem = ${origem}, responsavel_id = ${responsavelId}::uuid, notas = ${notas},
          updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    } else {
      await sql`
        UPDATE crm_leads SET
          nome = ${nome}, email = ${email}, telefone = ${telefone}, tipo = ${tipo},
          empresa = ${empresa}, area_interesse = ${areaInteresse}, estagio = ${estagio},
          origem = ${origem}, responsavel_id = NULL, notas = ${notas},
          updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    }
  } catch (err) {
    console.error("updateLeadAction:", err);
    return { error: "Erro ao atualizar lead." };
  }

  await logAction({
    acao: "editar",
    entidade: "lead",
    entidadeId: id,
    descricao: `Editou lead: ${nome}`,
  });
  revalidatePath("/dashboard/crm");
  revalidatePath(`/dashboard/crm/leads/${id}`);
  return { success: true };
}

// ── Helper: garante cliente + processo ao fechar lead ─────────────────────────

async function garantirClienteEProcesso(leadId: string): Promise<void> {
  const rows = await sql`
    SELECT nome, email, telefone, tipo, empresa, area_interesse,
           client_id::text, processo_id::text
    FROM crm_leads WHERE id = ${leadId}::uuid
  `;
  if (rows.length === 0) return;
  const lead = rows[0];

  // 1. Cria cliente se ainda não existe
  let clientId: string = lead.client_id ?? "";
  if (!clientId) {
    const cr = await sql`
      INSERT INTO clients (type, name, doc, email, phone, cep, street, addr_number, neighborhood, city, state, status)
      VALUES (
        ${lead.tipo ?? "PF"},
        ${lead.nome},
        '',
        ${lead.email ?? ""},
        ${lead.telefone ?? ""},
        '', '', '', '', '', '', 'ativo'
      )
      RETURNING id::text
    `;
    clientId = cr[0].id;
    await sql`UPDATE crm_leads SET client_id = ${clientId}::uuid WHERE id = ${leadId}::uuid`;
    revalidatePath("/dashboard/clientes");
  }

  // 2. Cria processo em Análise se ainda não existe
  if (!lead.processo_id) {
    const area = (lead.area_interesse as string | null) ?? "A Definir";
    const pr = await sql`
      INSERT INTO processos (client_id, lead_id, tipo_acao, area, status, estagio_producao, data_estagio_at)
      VALUES (
        ${clientId}::uuid,
        ${leadId}::uuid,
        ${area},
        ${area},
        'ativo',
        'analise',
        NOW()
      )
      RETURNING id::text
    `;
    const processoId = pr[0].id;
    await sql`UPDATE crm_leads SET processo_id = ${processoId}::uuid WHERE id = ${leadId}::uuid`;
    revalidatePath("/dashboard/producao");
  }
}

export async function moveLeadEstagioAction(
  id: string,
  estagio: string
): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "editar")) return;

  await sql`
    UPDATE crm_leads SET estagio = ${estagio}, updated_at = NOW()
    WHERE id = ${id}::uuid
  `;
  // Ao fechar: garante cliente + processo em Análise
  if (estagio === "fechado") {
    await garantirClienteEProcesso(id);
  }
  revalidatePath("/dashboard/crm");
  revalidatePath(`/dashboard/crm/leads/${id}`);
}

export async function deleteLeadAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "excluir")) return;

  await sql`DELETE FROM crm_leads WHERE id = ${id}::uuid`;
  await logAction({
    acao: "excluir",
    entidade: "lead",
    entidadeId: id,
    descricao: "Excluiu lead",
  });
  revalidatePath("/dashboard/crm");
}

export async function convertLeadToClientAction(
  leadId: string
): Promise<{ error?: string; clientId?: string; processoId?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "editar"))
    return { error: "Sem permissão." };

  try {
    await sql`UPDATE crm_leads SET estagio = 'fechado', updated_at = NOW() WHERE id = ${leadId}::uuid`;
    await garantirClienteEProcesso(leadId);

    const rows =
      await sql`SELECT client_id::text, processo_id::text FROM crm_leads WHERE id = ${leadId}::uuid`;
    revalidatePath("/dashboard/crm");
    revalidatePath("/dashboard/clientes");
    return { clientId: rows[0].client_id, processoId: rows[0].processo_id };
  } catch (err) {
    console.error("convertLeadToClientAction:", err);
    return { error: "Erro ao converter lead." };
  }
}

// ── Atividades ────────────────────────────────────────────────────────────────

export async function createAtividadeAction(
  _prev: CrmFormState,
  formData: FormData
): Promise<CrmFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "criar"))
    return { error: "Sem permissão." };

  const leadId = ((formData.get("lead_id") as string) ?? "").trim();
  const tipo = ((formData.get("tipo") as string) ?? "").trim();
  const titulo = ((formData.get("titulo") as string) ?? "").trim();
  const descricao =
    ((formData.get("descricao") as string) ?? "").trim() || null;
  const dataHora = ((formData.get("data_hora") as string) ?? "").trim() || null;
  const responsavelId =
    ((formData.get("responsavel_id") as string) ?? "").trim() || null;

  if (!leadId) return { error: "Lead inválido." };
  if (!tipo) return { error: "Tipo é obrigatório." };
  if (!titulo) return { error: "Título é obrigatório." };

  try {
    if (responsavelId && dataHora) {
      await sql`
        INSERT INTO crm_atividades (lead_id, tipo, titulo, descricao, data_hora, responsavel_id)
        VALUES (${leadId}::uuid, ${tipo}, ${titulo}, ${descricao}, ${dataHora}::timestamptz, ${responsavelId}::uuid)
      `;
    } else if (responsavelId) {
      await sql`
        INSERT INTO crm_atividades (lead_id, tipo, titulo, descricao, responsavel_id)
        VALUES (${leadId}::uuid, ${tipo}, ${titulo}, ${descricao}, ${responsavelId}::uuid)
      `;
    } else if (dataHora) {
      await sql`
        INSERT INTO crm_atividades (lead_id, tipo, titulo, descricao, data_hora)
        VALUES (${leadId}::uuid, ${tipo}, ${titulo}, ${descricao}, ${dataHora}::timestamptz)
      `;
    } else {
      await sql`
        INSERT INTO crm_atividades (lead_id, tipo, titulo, descricao)
        VALUES (${leadId}::uuid, ${tipo}, ${titulo}, ${descricao})
      `;
    }
  } catch (err) {
    console.error("createAtividadeAction:", err);
    return { error: "Erro ao registrar atividade." };
  }

  revalidatePath(`/dashboard/crm/leads/${leadId}`);
  revalidatePath("/dashboard/crm");
  return { success: true };
}

export async function deleteAtividadeAction(
  id: string,
  leadId: string
): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "excluir")) return;

  await sql`DELETE FROM crm_atividades WHERE id = ${id}::uuid`;
  revalidatePath(`/dashboard/crm/leads/${leadId}`);
}

// ── Tarefas ───────────────────────────────────────────────────────────────────

export async function createTarefaAction(
  _prev: CrmFormState,
  formData: FormData
): Promise<CrmFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "criar"))
    return { error: "Sem permissão." };

  const leadId = ((formData.get("lead_id") as string) ?? "").trim();
  const titulo = ((formData.get("titulo") as string) ?? "").trim();
  const descricao =
    ((formData.get("descricao") as string) ?? "").trim() || null;
  const dataVencimento =
    ((formData.get("data_vencimento") as string) ?? "").trim() || null;
  const responsavelId =
    ((formData.get("responsavel_id") as string) ?? "").trim() || null;

  if (!leadId) return { error: "Lead inválido." };
  if (!titulo) return { error: "Título é obrigatório." };

  try {
    if (responsavelId && dataVencimento) {
      await sql`
        INSERT INTO crm_tarefas (lead_id, titulo, descricao, data_vencimento, responsavel_id)
        VALUES (${leadId}::uuid, ${titulo}, ${descricao}, ${dataVencimento}::date, ${responsavelId}::uuid)
      `;
    } else if (responsavelId) {
      await sql`
        INSERT INTO crm_tarefas (lead_id, titulo, descricao, responsavel_id)
        VALUES (${leadId}::uuid, ${titulo}, ${descricao}, ${responsavelId}::uuid)
      `;
    } else if (dataVencimento) {
      await sql`
        INSERT INTO crm_tarefas (lead_id, titulo, descricao, data_vencimento)
        VALUES (${leadId}::uuid, ${titulo}, ${descricao}, ${dataVencimento}::date)
      `;
    } else {
      await sql`
        INSERT INTO crm_tarefas (lead_id, titulo, descricao)
        VALUES (${leadId}::uuid, ${titulo}, ${descricao})
      `;
    }
  } catch (err) {
    console.error("createTarefaAction:", err);
    return { error: "Erro ao criar tarefa." };
  }

  revalidatePath(`/dashboard/crm/leads/${leadId}`);
  return { success: true };
}

export async function toggleTarefaAction(
  id: string,
  leadId: string,
  concluida: boolean
): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "editar")) return;

  await sql`
    UPDATE crm_tarefas SET concluida = ${concluida}, updated_at = NOW()
    WHERE id = ${id}::uuid
  `;
  revalidatePath(`/dashboard/crm/leads/${leadId}`);
  revalidatePath("/dashboard/crm");
}

export async function deleteTarefaAction(
  id: string,
  leadId: string
): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "crm", "excluir")) return;

  await sql`DELETE FROM crm_tarefas WHERE id = ${id}::uuid`;
  revalidatePath(`/dashboard/crm/leads/${leadId}`);
}
