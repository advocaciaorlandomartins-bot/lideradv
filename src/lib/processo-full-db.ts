import sql from "./db";
import type { ProcessoFull } from "./processos-db";

export type { ProcessoFull };

export type FaseWorkflow = "pre_contrato" | "elaboracao" | "arquivado";

export interface ProcessoExtended extends ProcessoFull {
  tipo_demanda: string;
  prioridade: string;
  assunto: string | null;
  relato: string | null;
  responsavel_id: string | null;
  responsavel_nome: string | null;
  resultado: string | null;
  fase_workflow: FaseWorkflow;
  fase_precontrato_at: string | null;
  fase_elaboracao_at: string | null;
  fase_arquivado_at: string | null;
}

export interface HistoricoRegistro {
  id: string;
  processo_id: string;
  client_id: string | null;
  texto: string;
  tipo: string;
  data_referencia: string | null;
  situacao: string | null;
  destaque: boolean;
  created_at_formatted: string;
}

export interface EventoControle {
  id: string;
  processo_id: string;
  titulo: string;
  tipo: string | null;
  data: string | null;
  hora: string | null;
  local: string | null;
  link_virtual: string | null;
  responsavel_nome: string | null;
  created_at_formatted: string;
}

export interface TarefaProcesso {
  id: string;
  processo_id: string;
  titulo: string;
  responsavel: string | null;
  prioridade: string;
  prazo: string | null;
  status: string;
  comentarios: string | null;
}

export interface PendenciaCliente {
  id: string;
  processo_id: string;
  descricao: string;
  status: string;
  created_at_formatted: string;
}

export interface ColaboradorSimples {
  id: string;
  nome: string;
  cargo: string;
}

export async function getProcessoExtended(
  id: string
): Promise<ProcessoExtended | null> {
  const rows = await sql`
    SELECT
      p.id::text,
      p.client_id::text,
      c.name                                              AS client_name,
      p.numero, p.tipo_acao, p.area, p.fase,
      p.vara, p.comarca,
      p.parte_contraria, p.parte_contraria_doc,
      p.valor_causa, p.status, p.notas,
      to_char(p.data_distribuicao, 'DD/MM/YYYY')          AS data_distribuicao,
      to_char(p.data_distribuicao, 'YYYY-MM-DD')          AS data_distribuicao_iso,
      p.tipo_demanda,
      COALESCE(p.prioridade, 'Média')                     AS prioridade,
      p.assunto,
      p.relato,
      p.responsavel_id::text,
      col.nome                                            AS responsavel_nome,
      p.resultado,
      COALESCE(p.fase_workflow, 'pre_contrato')           AS fase_workflow,
      to_char(p.fase_precontrato_at, 'DD/MM/YYYY HH24:MI') AS fase_precontrato_at,
      to_char(p.fase_elaboracao_at,  'DD/MM/YYYY HH24:MI') AS fase_elaboracao_at,
      to_char(p.fase_arquivado_at,   'DD/MM/YYYY HH24:MI') AS fase_arquivado_at,
      p.created_at
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN colaboradores col ON col.id = p.responsavel_id
    WHERE p.id = ${id}::uuid
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    client_id: r.client_id,
    client_name: r.client_name,
    numero: r.numero ?? null,
    tipo_acao: r.tipo_acao,
    area: r.area,
    fase: r.fase ?? null,
    vara: r.vara ?? null,
    comarca: r.comarca ?? null,
    parte_contraria: r.parte_contraria ?? null,
    parte_contraria_doc: r.parte_contraria_doc ?? null,
    valor_causa: r.valor_causa ? Number(r.valor_causa) : null,
    status: r.status as "ativo" | "arquivado" | "encerrado",
    data_distribuicao: r.data_distribuicao ?? null,
    data_distribuicao_iso: r.data_distribuicao_iso ?? null,
    notas: r.notas ?? null,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
    tipo_demanda: r.tipo_demanda ?? "Judicial",
    prioridade: r.prioridade ?? "Média",
    assunto: r.assunto ?? null,
    relato: r.relato ?? null,
    responsavel_id: r.responsavel_id ?? null,
    responsavel_nome: r.responsavel_nome ?? null,
    resultado: r.resultado ?? null,
    fase_workflow: (r.fase_workflow ?? "pre_contrato") as FaseWorkflow,
    fase_precontrato_at: r.fase_precontrato_at ?? null,
    fase_elaboracao_at: r.fase_elaboracao_at ?? null,
    fase_arquivado_at: r.fase_arquivado_at ?? null,
  };
}

export async function getHistoricoByProcesso(
  processoId: string
): Promise<HistoricoRegistro[]> {
  const rows = await sql`
    SELECT id::text, processo_id::text, client_id::text, texto, tipo,
           to_char(data_referencia, 'DD/MM/YYYY') AS data_referencia,
           situacao, destaque, created_at
    FROM historico_registros
    WHERE processo_id = ${processoId}::uuid
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    processo_id: r.processo_id,
    client_id: r.client_id ?? null,
    texto: r.texto,
    tipo: r.tipo,
    data_referencia: r.data_referencia ?? null,
    situacao: r.situacao ?? null,
    destaque: r.destaque,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
  }));
}

export async function getEventosByProcesso(
  processoId: string
): Promise<EventoControle[]> {
  const rows = await sql`
    SELECT e.id::text, e.processo_id::text, e.titulo, e.tipo,
           to_char(e.data, 'DD/MM/YYYY') AS data,
           to_char(e.hora, 'HH24:MI')    AS hora,
           e.local, e.link_virtual,
           col.nome AS responsavel_nome,
           e.created_at
    FROM eventos_controles e
    LEFT JOIN colaboradores col ON col.id = e.responsavel_id
    WHERE e.processo_id = ${processoId}::uuid
    ORDER BY e.data DESC NULLS LAST, e.created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    processo_id: r.processo_id,
    titulo: r.titulo,
    tipo: r.tipo ?? null,
    data: r.data ?? null,
    hora: r.hora ?? null,
    local: r.local ?? null,
    link_virtual: r.link_virtual ?? null,
    responsavel_nome: r.responsavel_nome ?? null,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
  }));
}

export async function getTarefasByProcesso(
  processoId: string
): Promise<TarefaProcesso[]> {
  const rows = await sql`
    SELECT id::text, processo_id::text, titulo, responsavel, prioridade,
           to_char(prazo, 'DD/MM/YYYY') AS prazo, status, comentarios
    FROM tarefas_processo
    WHERE processo_id = ${processoId}::uuid
    ORDER BY
      CASE prioridade WHEN 'Alta' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END,
      prazo ASC NULLS LAST,
      created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    processo_id: r.processo_id,
    titulo: r.titulo,
    responsavel: r.responsavel ?? null,
    prioridade: r.prioridade,
    prazo: r.prazo ?? null,
    status: r.status,
    comentarios: r.comentarios ?? null,
  }));
}

export async function getPendenciasByProcesso(
  processoId: string
): Promise<PendenciaCliente[]> {
  const rows = await sql`
    SELECT id::text, processo_id::text, descricao, status, created_at
    FROM pendencias_cliente
    WHERE processo_id = ${processoId}::uuid
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    processo_id: r.processo_id,
    descricao: r.descricao,
    status: r.status,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
  }));
}

export async function getColaboradoresAtivos(): Promise<ColaboradorSimples[]> {
  const rows = await sql`
    SELECT id::text, nome, cargo FROM colaboradores
    WHERE status = 'ativo'
    ORDER BY nome
  `;
  return rows.map((r) => ({ id: r.id, nome: r.nome, cargo: r.cargo }));
}
