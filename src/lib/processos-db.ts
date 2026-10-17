import sql from "./db";
import { parseChecklist, type ChecklistItem } from "./checklist-types";

export interface Processo {
  id: string;
  client_id: string;
  client_name: string;
  numero: string | null;
  tipo_acao: string;
  area: string;
  fase: string | null;
  vara: string | null;
  comarca: string | null;
  parte_contraria: string | null;
  parte_contraria_doc: string | null;
  valor_causa: number | null;
  status: "ativo" | "em_andamento" | "arquivado" | "encerrado";
  data_distribuicao: string | null;
  data_distribuicao_iso: string | null;
  created_at_formatted: string;
  updated_at: Date | null;
  estagio_producao: string;
  resultado_administrativo: string | null;
  resultado_judicial: string | null;
  // Campos previdenciários
  data_protocolo_inss: string | null;
  protocolo_inss: string | null;
  agencia_inss: string | null;
  resultado_admin: string | null;
  data_resultado_admin: string | null;
  motivo_indeferimento: string | null;
  modelo_honorario: string | null;
  valor_honorario: number | null;
  percentual_honorario: number | null;
  num_beneficio_concedido: string | null;
  // Datas previdenciárias críticas
  der: string | null;
  dib: string | null;
  dcb: string | null;
  /** Categoria/portfólio pra segmentar processos (ex: "Carteira A",
   * "Campanha INSS") — texto livre, nunca obrigatório no banco; a
   * obrigatoriedade na tela é controlada por um ajuste do usuário. */
  carteira: string | null;
  /** Etiquetas no formato "CATEGORIA:VALOR" — próprias do processo + herdadas do cliente vinculado. */
  etiquetas: string[];
  // Diagnóstico herdado do cadastro do cliente, pra priorizar visualmente
  // qual processo tratar primeiro direto na listagem.
  cid_principal: string | null;
  // Documentos necessários pra dar entrada — ver checklistPadrao em
  // checklist-documentos.ts.
  checklist: ChecklistItem[];
}

export interface ProcessoFull extends Processo {
  parte_contraria_doc: string | null;
  notas: string | null;
  data_distribuicao_iso: string | null;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Processo {
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
    status: r.status as "ativo" | "em_andamento" | "arquivado" | "encerrado",
    data_distribuicao: r.data_distribuicao ?? null,
    data_distribuicao_iso: r.data_distribuicao_iso ?? null,
    created_at_formatted: formatDate(new Date(r.created_at)),
    updated_at: r.updated_at ? new Date(r.updated_at) : null,
    estagio_producao: r.estagio_producao ?? "analise",
    resultado_administrativo: r.resultado_administrativo ?? null,
    resultado_judicial: r.resultado_judicial ?? null,
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
    carteira: r.carteira ?? null,
    etiquetas: Array.isArray(r.etiquetas) ? r.etiquetas.map(String) : [],
    cid_principal: r.cid_principal ?? null,
    checklist: parseChecklist(r.checklist),
  };
}

/**
 * Contagem de processos visíveis — mesma regra de escopo de getAllProcessos,
 * sem carregar as linhas inteiras. Usado no KPI do Dashboard para bater com
 * o número que a lista de Processos realmente mostra para aquele usuário.
 */
export async function getProcessosCount(
  responsavelId?: string | null
): Promise<number> {
  const rows = responsavelId
    ? await sql`
        SELECT COUNT(*)::int AS total FROM processos
        WHERE deleted_at IS NULL AND responsavel_id = ${responsavelId}::uuid
      `
    : await sql`
        SELECT COUNT(*)::int AS total FROM processos WHERE deleted_at IS NULL
      `;
  return Number(rows[0]?.total ?? 0);
}

/**
 * responsavelId: quando informado, restringe aos processos em que esse
 * colaborador é responsável — usado para quem não tem a permissão
 * "processos_ver_todos" (por padrão, só Administrador(a)/Sócio(a) veem tudo).
 */
export async function getAllProcessos(
  responsavelId?: string | null
): Promise<Processo[]> {
  const rows = responsavelId
    ? await sql`
        SELECT
          p.id::text,
          p.client_id::text,
          c.name AS client_name,
          p.numero,
          p.tipo_acao,
          p.area,
          p.fase,
          p.vara,
          p.comarca,
          p.parte_contraria,
          p.parte_contraria_doc,
          p.valor_causa,
          p.status,
          to_char(p.data_distribuicao, 'DD/MM/YYYY') AS data_distribuicao,
          to_char(p.data_distribuicao, 'YYYY-MM-DD') AS data_distribuicao_iso,
          p.created_at,
          p.updated_at,
          p.estagio_producao,
          p.resultado_administrativo,
          p.resultado_judicial,
          to_char(p.data_protocolo_inss, 'YYYY-MM-DD') AS data_protocolo_inss,
          p.protocolo_inss, p.agencia_inss, p.resultado_admin,
          to_char(p.data_resultado_admin, 'YYYY-MM-DD') AS data_resultado_admin,
          p.motivo_indeferimento, p.modelo_honorario,
          p.valor_honorario, p.percentual_honorario, p.num_beneficio_concedido,
          to_char(p.der, 'YYYY-MM-DD') AS der,
          to_char(p.dib, 'YYYY-MM-DD') AS dib,
          to_char(p.dcb, 'YYYY-MM-DD') AS dcb,
          p.carteira,
          c.cid_principal,
          p.checklist,
          (
            SELECT COALESCE(array_agg(DISTINCT e.categoria || ':' || e.valor), ARRAY[]::text[])
            FROM etiquetas e
            WHERE e.id IN (
              SELECT etiqueta_id FROM etiquetas_processos WHERE processo_id = p.id
              UNION
              SELECT etiqueta_id FROM etiquetas_clientes WHERE cliente_id = p.client_id
            )
          ) AS etiquetas
        FROM processos p
        JOIN clients c ON c.id = p.client_id
        WHERE p.deleted_at IS NULL AND p.responsavel_id = ${responsavelId}::uuid
        ORDER BY COALESCE(p.updated_at, p.created_at) DESC
        LIMIT 3000
      `
    : await sql`
        SELECT
          p.id::text,
          p.client_id::text,
          c.name AS client_name,
          p.numero,
          p.tipo_acao,
          p.area,
          p.fase,
          p.vara,
          p.comarca,
          p.parte_contraria,
          p.parte_contraria_doc,
          p.valor_causa,
          p.status,
          to_char(p.data_distribuicao, 'DD/MM/YYYY') AS data_distribuicao,
          to_char(p.data_distribuicao, 'YYYY-MM-DD') AS data_distribuicao_iso,
          p.created_at,
          p.updated_at,
          p.estagio_producao,
          p.resultado_administrativo,
          p.resultado_judicial,
          to_char(p.data_protocolo_inss, 'YYYY-MM-DD') AS data_protocolo_inss,
          p.protocolo_inss, p.agencia_inss, p.resultado_admin,
          to_char(p.data_resultado_admin, 'YYYY-MM-DD') AS data_resultado_admin,
          p.motivo_indeferimento, p.modelo_honorario,
          p.valor_honorario, p.percentual_honorario, p.num_beneficio_concedido,
          to_char(p.der, 'YYYY-MM-DD') AS der,
          to_char(p.dib, 'YYYY-MM-DD') AS dib,
          to_char(p.dcb, 'YYYY-MM-DD') AS dcb,
          p.carteira,
          c.cid_principal,
          p.checklist,
          (
            SELECT COALESCE(array_agg(DISTINCT e.categoria || ':' || e.valor), ARRAY[]::text[])
            FROM etiquetas e
            WHERE e.id IN (
              SELECT etiqueta_id FROM etiquetas_processos WHERE processo_id = p.id
              UNION
              SELECT etiqueta_id FROM etiquetas_clientes WHERE cliente_id = p.client_id
            )
          ) AS etiquetas
        FROM processos p
        JOIN clients c ON c.id = p.client_id
        WHERE p.deleted_at IS NULL
        ORDER BY COALESCE(p.updated_at, p.created_at) DESC
        LIMIT 3000
      `;
  // Sem paginação de verdade (busca/filtro/ordenação roda client-side em
  // cima do array inteiro). LIMIT é só rede de segurança contra
  // crescimento sem fim — ver mesmo comentário em clients-db.ts.
  return rows.map(mapRow);
}

export async function getProcessoById(id: string): Promise<Processo | null> {
  const rows = await sql`
    SELECT
      p.id::text,
      p.client_id::text,
      c.name AS client_name,
      p.numero,
      p.tipo_acao,
      p.area,
      p.fase,
      p.vara,
      p.comarca,
      p.parte_contraria,
      p.valor_causa,
      p.status,
      to_char(p.data_distribuicao, 'DD/MM/YYYY') AS data_distribuicao,
      p.created_at,
      p.updated_at,
      p.estagio_producao,
      p.resultado_administrativo,
      p.resultado_judicial,
      to_char(p.data_protocolo_inss, 'YYYY-MM-DD') AS data_protocolo_inss,
      p.protocolo_inss, p.agencia_inss, p.resultado_admin,
      to_char(p.data_resultado_admin, 'YYYY-MM-DD') AS data_resultado_admin,
      p.motivo_indeferimento, p.modelo_honorario,
      p.valor_honorario, p.percentual_honorario, p.num_beneficio_concedido,
      to_char(p.der, 'YYYY-MM-DD') AS der,
      to_char(p.dib, 'YYYY-MM-DD') AS dib,
      to_char(p.dcb, 'YYYY-MM-DD') AS dcb,
      p.carteira,
      p.checklist
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = ${id}::uuid AND p.deleted_at IS NULL
  `;
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

export async function getProcessoFull(
  id: string
): Promise<ProcessoFull | null> {
  const rows = await sql`
    SELECT
      p.id::text,
      p.client_id::text,
      c.name AS client_name,
      p.numero,
      p.tipo_acao,
      p.area,
      p.fase,
      p.vara,
      p.comarca,
      p.parte_contraria,
      p.parte_contraria_doc,
      p.valor_causa,
      p.status,
      to_char(p.data_distribuicao, 'DD/MM/YYYY') AS data_distribuicao,
      to_char(p.data_distribuicao, 'YYYY-MM-DD') AS data_distribuicao_iso,
      p.notas,
      p.created_at, p.updated_at,
      p.estagio_producao, p.resultado_administrativo, p.resultado_judicial,
      to_char(p.data_protocolo_inss, 'YYYY-MM-DD') AS data_protocolo_inss,
      p.protocolo_inss, p.agencia_inss, p.resultado_admin,
      to_char(p.data_resultado_admin, 'YYYY-MM-DD') AS data_resultado_admin,
      p.motivo_indeferimento, p.modelo_honorario,
      p.valor_honorario, p.percentual_honorario, p.num_beneficio_concedido,
      to_char(p.der, 'YYYY-MM-DD') AS der,
      to_char(p.dib, 'YYYY-MM-DD') AS dib,
      to_char(p.dcb, 'YYYY-MM-DD') AS dcb,
      p.carteira,
      p.checklist
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = ${id}::uuid AND p.deleted_at IS NULL
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...mapRow(r),
    parte_contraria_doc: r.parte_contraria_doc ?? null,
    notas: r.notas ?? null,
    data_distribuicao_iso: r.data_distribuicao_iso ?? null,
  };
}

export async function getProcessosByClientId(
  clientId: string
): Promise<Processo[]> {
  const rows = await sql`
    SELECT
      p.id::text,
      p.client_id::text,
      c.name AS client_name,
      p.numero,
      p.tipo_acao,
      p.area,
      p.fase,
      p.vara,
      p.comarca,
      p.parte_contraria,
      p.parte_contraria_doc,
      p.valor_causa,
      p.status,
      to_char(p.data_distribuicao, 'DD/MM/YYYY') AS data_distribuicao,
      to_char(p.data_distribuicao, 'YYYY-MM-DD') AS data_distribuicao_iso,
      p.created_at,
      p.updated_at,
      p.estagio_producao,
      p.resultado_administrativo,
      p.resultado_judicial,
      to_char(p.data_protocolo_inss, 'YYYY-MM-DD') AS data_protocolo_inss,
      p.protocolo_inss, p.agencia_inss, p.resultado_admin,
      to_char(p.data_resultado_admin, 'YYYY-MM-DD') AS data_resultado_admin,
      p.motivo_indeferimento, p.modelo_honorario,
      p.valor_honorario, p.percentual_honorario, p.num_beneficio_concedido,
      p.checklist
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    WHERE p.client_id = ${clientId}::uuid
      AND p.deleted_at IS NULL
    ORDER BY COALESCE(p.updated_at, p.created_at) DESC
  `;
  return rows.map(mapRow);
}

export interface ContadoresAtividadesPrazo {
  atrasadas: number;
  hoje: number;
  amanha: number;
  futuras: number;
  semData: number;
}

/**
 * Tarefas abertas (não concluídas/canceladas) dos processos visíveis ao
 * usuário, agrupadas por prazo — inspirado no painel "Atividades" da lista
 * de processos do concorrente Tramitação Inteligente (levantamento de
 * 17/10/2026). responsavelId null = escritório inteiro (mesma regra de
 * "processos_ver_todos" usada no resto do módulo).
 */
export async function getContadoresAtividadesPrazo(
  responsavelId: string | null
): Promise<ContadoresAtividadesPrazo> {
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE t.prazo < CURRENT_DATE)::int AS atrasadas,
      COUNT(*) FILTER (WHERE t.prazo = CURRENT_DATE)::int AS hoje,
      COUNT(*) FILTER (WHERE t.prazo = CURRENT_DATE + 1)::int AS amanha,
      COUNT(*) FILTER (WHERE t.prazo > CURRENT_DATE + 1)::int AS futuras,
      COUNT(*) FILTER (WHERE t.prazo IS NULL)::int AS sem_data
    FROM tarefas_processo t
    JOIN processos p ON p.id = t.processo_id
    WHERE p.deleted_at IS NULL
      AND (${responsavelId}::uuid IS NULL OR p.responsavel_id = ${responsavelId}::uuid)
      AND t.status IN ('Pendente', 'Em andamento')
  `;
  const r = rows[0];
  return {
    atrasadas: Number(r?.atrasadas ?? 0),
    hoje: Number(r?.hoje ?? 0),
    amanha: Number(r?.amanha ?? 0),
    futuras: Number(r?.futuras ?? 0),
    semData: Number(r?.sem_data ?? 0),
  };
}
