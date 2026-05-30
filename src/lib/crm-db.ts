import sql from "./db";
import type { Lead, Atividade, Tarefa, Estagio } from "./crm-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLead(r: any): Lead {
  return {
    id: r.id,
    nome: r.nome,
    email: r.email ?? null,
    telefone: r.telefone ?? null,
    tipo: r.tipo as "PF" | "PJ",
    empresa: r.empresa ?? null,
    area_interesse: r.area_interesse ?? null,
    estagio: r.estagio as Estagio,
    origem: r.origem ?? null,
    responsavel_id: r.responsavel_id ?? null,
    responsavel_nome: r.responsavel_nome ?? null,
    client_id: r.client_id ?? null,
    notas: r.notas ?? null,
    created_at: new Date(r.created_at).toLocaleDateString("pt-BR"),
    updated_at: new Date(r.updated_at).toLocaleDateString("pt-BR"),
    atividades_count: Number(r.atividades_count ?? 0),
    tarefas_pendentes: Number(r.tarefas_pendentes ?? 0),
  };
}

export async function getAllLeads(): Promise<Lead[]> {
  const rows = await sql`
    SELECT
      l.id::text,
      l.nome, l.email, l.telefone, l.tipo, l.empresa,
      l.area_interesse, l.estagio, l.origem,
      l.responsavel_id::text,
      col.nome AS responsavel_nome,
      l.client_id::text,
      l.notas, l.created_at, l.updated_at,
      (SELECT COUNT(*)::int FROM crm_atividades WHERE lead_id = l.id) AS atividades_count,
      (SELECT COUNT(*)::int FROM crm_tarefas    WHERE lead_id = l.id AND concluida = FALSE) AS tarefas_pendentes
    FROM crm_leads l
    LEFT JOIN colaboradores col ON col.id = l.responsavel_id
    ORDER BY l.created_at DESC
  `;
  return rows.map(mapLead);
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const rows = await sql`
    SELECT
      l.id::text,
      l.nome, l.email, l.telefone, l.tipo, l.empresa,
      l.area_interesse, l.estagio, l.origem,
      l.responsavel_id::text,
      col.nome AS responsavel_nome,
      l.client_id::text,
      l.notas, l.created_at, l.updated_at,
      (SELECT COUNT(*)::int FROM crm_atividades WHERE lead_id = l.id) AS atividades_count,
      (SELECT COUNT(*)::int FROM crm_tarefas    WHERE lead_id = l.id AND concluida = FALSE) AS tarefas_pendentes
    FROM crm_leads l
    LEFT JOIN colaboradores col ON col.id = l.responsavel_id
    WHERE l.id = ${id}::uuid
  `;
  if (rows.length === 0) return null;
  return mapLead(rows[0]);
}

export async function getAtividadesByLead(
  leadId: string
): Promise<Atividade[]> {
  const rows = await sql`
    SELECT
      a.id::text,
      a.lead_id::text,
      a.tipo, a.titulo, a.descricao, a.data_hora,
      a.responsavel_id::text,
      col.nome AS responsavel_nome,
      a.created_at
    FROM crm_atividades a
    LEFT JOIN colaboradores col ON col.id = a.responsavel_id
    WHERE a.lead_id = ${leadId}::uuid
    ORDER BY a.data_hora DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    lead_id: r.lead_id,
    tipo: r.tipo,
    titulo: r.titulo,
    descricao: r.descricao ?? null,
    data_hora: new Date(r.data_hora).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    responsavel_id: r.responsavel_id ?? null,
    responsavel_nome: r.responsavel_nome ?? null,
    created_at: r.created_at,
  }));
}

export async function getTarefasByLead(leadId: string): Promise<Tarefa[]> {
  const rows = await sql`
    SELECT
      t.id::text,
      t.lead_id::text,
      t.titulo, t.descricao,
      to_char(t.data_vencimento, 'DD/MM/YYYY') AS data_vencimento,
      t.concluida,
      t.responsavel_id::text,
      col.nome AS responsavel_nome,
      t.created_at
    FROM crm_tarefas t
    LEFT JOIN colaboradores col ON col.id = t.responsavel_id
    WHERE t.lead_id = ${leadId}::uuid
    ORDER BY t.concluida ASC, t.data_vencimento ASC NULLS LAST
  `;
  return rows.map((r) => ({
    id: r.id,
    lead_id: r.lead_id,
    titulo: r.titulo,
    descricao: r.descricao ?? null,
    data_vencimento: r.data_vencimento ?? null,
    concluida: r.concluida ?? false,
    responsavel_id: r.responsavel_id ?? null,
    responsavel_nome: r.responsavel_nome ?? null,
    created_at: r.created_at,
  }));
}
