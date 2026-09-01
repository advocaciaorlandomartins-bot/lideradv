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
  // Produção
  estagio_producao: string;
  resultado_administrativo: string | null;
  resultado_judicial: string | null;
  dias_no_estagio: number;
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
  status: string | null;
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
  coResponsaveis: { colaboradorId: string; nome: string }[];
}

export interface PendenciaCliente {
  id: string;
  processo_id: string;
  descricao: string;
  status: string;
  created_at_formatted: string;
}

export interface PendenciaAberta {
  id: string;
  processo_id: string;
  descricao: string;
  criadaEm: string;
  diasAberta: number;
  processoNumero: string | null;
  tipoAcao: string | null;
  clienteId: string | null;
  clienteNome: string | null;
  clienteTelefone: string | null;
  responsavelNome: string | null;
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
      p.created_at,
      p.updated_at,
      COALESCE(p.estagio_producao, 'analise')             AS estagio_producao,
      p.resultado_administrativo,
      p.resultado_judicial,
      EXTRACT(EPOCH FROM (NOW() - p.data_estagio_at))::int / 86400 AS dias_no_estagio,
      to_char(p.data_protocolo_inss, 'YYYY-MM-DD')        AS data_protocolo_inss,
      p.protocolo_inss, p.agencia_inss, p.resultado_admin,
      to_char(p.data_resultado_admin, 'YYYY-MM-DD')        AS data_resultado_admin,
      p.motivo_indeferimento, p.modelo_honorario,
      p.valor_honorario, p.percentual_honorario, p.num_beneficio_concedido,
      to_char(p.der, 'YYYY-MM-DD')                         AS der,
      to_char(p.dib, 'YYYY-MM-DD')                         AS dib,
      to_char(p.dcb, 'YYYY-MM-DD')                         AS dcb
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    LEFT JOIN colaboradores col ON col.id = p.responsavel_id
    WHERE p.id = ${id}::uuid AND p.deleted_at IS NULL
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
    estagio_producao: r.estagio_producao ?? "analise",
    resultado_administrativo: r.resultado_administrativo ?? null,
    resultado_judicial: r.resultado_judicial ?? null,
    dias_no_estagio: Number(r.dias_no_estagio ?? 0),
    updated_at: r.updated_at ? new Date(r.updated_at) : null,
    data_protocolo_inss: r.data_protocolo_inss
      ? String(r.data_protocolo_inss).slice(0, 10)
      : null,
    protocolo_inss: r.protocolo_inss ?? null,
    agencia_inss: r.agencia_inss ?? null,
    resultado_admin: r.resultado_admin ?? null,
    data_resultado_admin: r.data_resultado_admin
      ? String(r.data_resultado_admin).slice(0, 10)
      : null,
    motivo_indeferimento: r.motivo_indeferimento ?? null,
    modelo_honorario: r.modelo_honorario ?? null,
    valor_honorario:
      r.valor_honorario != null ? Number(r.valor_honorario) : null,
    percentual_honorario:
      r.percentual_honorario != null ? Number(r.percentual_honorario) : null,
    num_beneficio_concedido: r.num_beneficio_concedido ?? null,
    der: r.der ? String(r.der).slice(0, 10) : null,
    dib: r.dib ? String(r.dib).slice(0, 10) : null,
    dcb: r.dcb ? String(r.dcb).slice(0, 10) : null,
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
           e.status,
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
    status: r.status ? String(r.status) : null,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
  }));
}

export async function getTarefasByProcesso(
  processoId: string
): Promise<TarefaProcesso[]> {
  const rows = await sql`
    SELECT t.id::text, t.processo_id::text, t.titulo, t.responsavel, t.prioridade,
           to_char(t.prazo, 'DD/MM/YYYY') AS prazo, t.status, t.comentarios,
           (
             SELECT COALESCE(
               json_agg(json_build_object('colaboradorId', col.id::text, 'nome', col.nome) ORDER BY col.nome),
               '[]'::json
             )
             FROM tarefa_responsaveis_adicionais tra
             JOIN colaboradores col ON col.id = tra.colaborador_id
             WHERE tra.tarefa_id = t.id
           ) AS co_responsaveis
    FROM tarefas_processo t
    WHERE t.processo_id = ${processoId}::uuid
    ORDER BY
      CASE t.prioridade WHEN 'Alta' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END,
      t.prazo ASC NULLS LAST,
      t.created_at DESC
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
    coResponsaveis:
      typeof r.co_responsaveis === "string"
        ? JSON.parse(r.co_responsaveis)
        : (r.co_responsaveis ?? []),
  }));
}

/**
 * Todas as pendências (documentos/ações faltando do cliente) ainda abertas
 * no escritório inteiro, das mais antigas pras mais novas — dá pra quem
 * cuida de cobrança/documentação varrer tudo num lugar só, em vez de abrir
 * processo por processo pra descobrir o que está travado. Telefone já
 * considera responsável legal (menor/incapaz), mesma regra usada nas
 * mensagens automáticas do sistema.
 */
export async function getPendenciasAbertas(
  verTodos: boolean,
  colaboradorId: string | null
): Promise<PendenciaAberta[]> {
  const rows = await sql`
    SELECT
      pc.id::text, pc.processo_id::text, pc.descricao, pc.created_at,
      p.numero AS processo_numero, p.tipo_acao,
      cl.id::text AS cliente_id, cl.name AS cliente_nome,
      CASE WHEN cl.menor_incapaz THEN cl.responsavel_telefone ELSE cl.phone END AS cliente_telefone,
      col.nome AS responsavel_nome
    FROM pendencias_cliente pc
    JOIN processos p ON p.id = pc.processo_id
    LEFT JOIN clients cl ON cl.id = p.client_id
    LEFT JOIN colaboradores col ON col.id = p.responsavel_id
    WHERE pc.status = 'pendente'
      AND (${verTodos} OR p.responsavel_id = ${colaboradorId}::uuid)
    ORDER BY pc.created_at ASC
    LIMIT 200
  `;
  const now = Date.now();
  return rows.map((r) => ({
    id: String(r.id),
    processo_id: String(r.processo_id),
    descricao: String(r.descricao),
    criadaEm: new Date(r.created_at).toLocaleDateString("pt-BR"),
    diasAberta: Math.floor((now - new Date(r.created_at).getTime()) / 86400000),
    processoNumero: r.processo_numero ? String(r.processo_numero) : null,
    tipoAcao: r.tipo_acao ? String(r.tipo_acao) : null,
    clienteId: r.cliente_id ? String(r.cliente_id) : null,
    clienteNome: r.cliente_nome ? String(r.cliente_nome) : null,
    clienteTelefone: r.cliente_telefone ? String(r.cliente_telefone) : null,
    responsavelNome: r.responsavel_nome ? String(r.responsavel_nome) : null,
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
