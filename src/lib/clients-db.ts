import sql from "./db";

export interface Client {
  id: string;
  type: "PF" | "PJ";
  name: string;
  doc: string;
  trade_name: string | null;
  email: string;
  phone: string;
  city: string;
  state: string;
  status: "ativo" | "inativo";
  since: string;
  lastContact: string;
  processes: number;
}

function formatSince(date: Date): string {
  return date.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("pt-BR");
}

export async function getAllClients(): Promise<Client[]> {
  const rows = await sql`
    SELECT
      c.id::text,
      c.type,
      c.name,
      c.doc,
      c.trade_name,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.status,
      c.created_at,
      (SELECT COUNT(*)::int FROM processos WHERE client_id = c.id AND deleted_at IS NULL) AS process_count
    FROM clients c
    WHERE c.deleted_at IS NULL
    ORDER BY c.created_at DESC
  `;

  return rows.map((r) => ({
    id: r.id,
    type: r.type as "PF" | "PJ",
    name: r.name,
    doc: r.doc,
    trade_name: r.trade_name ?? null,
    email: r.email,
    phone: r.phone,
    city: r.city,
    state: r.state,
    status: r.status as "ativo" | "inativo",
    since: formatSince(new Date(r.created_at)),
    lastContact: formatDate(new Date(r.created_at)),
    processes: r.process_count ?? 0,
  }));
}

export interface ClientFull {
  id: string;
  type: "PF" | "PJ";
  name: string;
  doc: string;
  trade_name: string | null;
  birth_date: string | null;
  email: string;
  phone: string;
  rg: string | null;
  rg_orgao: string | null;
  estado_civil: string | null;
  genero: string | null;
  profissao: string | null;
  nacionalidade: string | null;
  senha_cliente: string | null;
  parceria: string | null;
  origem_tipo: string | null;
  origem_texto: string | null;
  indicador_id: string | null;
  indicador_nome: string | null;
  indicador_cargo: string | null;
  indicador_tipo_trabalho: string | null;
  comissao_tipo: string | null;
  comissao_valor: number | null;
  menor_incapaz: boolean;
  responsavel_nome: string | null;
  responsavel_cpf: string | null;
  responsavel_rg: string | null;
  responsavel_rg_orgao: string | null;
  responsavel_telefone: string | null;
  responsavel_email: string | null;
  responsavel_parentesco: string | null;
  cep: string;
  street: string;
  addr_number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  notes: string | null;
  status: "ativo" | "inativo";
  since: string;
  lastContact: string;
  processes: number;
  // Campos previdenciários
  nis: string | null;
  num_beneficio: string | null;
  status_beneficio: string | null;
  tipo_beneficio: string | null;
  data_inicio_beneficio: string | null;
  valor_beneficio: number | null;
  categoria_contribuinte: string | null;
  carencia_atingida: boolean | null;
  cid_principal: string | null;
  tipo_incapacidade: string | null;
  data_diagnostico: string | null;
  naturalidade_cidade: string | null;
  naturalidade_estado: string | null;
  filiacao_mae: string | null;
  filiacao_pai: string | null;
  data_afastamento: string | null;
  atividade_anterior: string | null;
  num_contribuicoes: number | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapClientFull(r: any, hasOrigemCols: boolean): ClientFull {
  return {
    id: r.id,
    type: r.type as "PF" | "PJ",
    name: r.name,
    doc: r.doc,
    trade_name: r.trade_name ?? null,
    birth_date: r.birth_date ?? null,
    email: r.email,
    phone: r.phone,
    rg: r.rg ?? null,
    rg_orgao: r.rg_orgao ?? null,
    estado_civil: r.estado_civil ?? null,
    genero: r.genero ?? null,
    profissao: r.profissao ?? null,
    nacionalidade: r.nacionalidade ?? null,
    senha_cliente: r.senha_cliente ?? null,
    parceria: r.parceria ?? null,
    origem_tipo: hasOrigemCols ? (r.origem_tipo ?? null) : null,
    origem_texto: hasOrigemCols ? (r.origem_texto ?? null) : null,
    indicador_id: hasOrigemCols ? (r.indicador_id ?? null) : null,
    indicador_nome: hasOrigemCols ? (r.indicador_nome ?? null) : null,
    indicador_cargo: hasOrigemCols ? (r.indicador_cargo ?? null) : null,
    indicador_tipo_trabalho: hasOrigemCols
      ? (r.indicador_tipo_trabalho ?? null)
      : null,
    comissao_tipo: hasOrigemCols ? (r.comissao_tipo ?? null) : null,
    comissao_valor:
      hasOrigemCols && r.comissao_valor != null
        ? Number(r.comissao_valor)
        : null,
    menor_incapaz: r.menor_incapaz ?? false,
    responsavel_nome: r.responsavel_nome ?? null,
    responsavel_cpf: r.responsavel_cpf ?? null,
    responsavel_rg: r.responsavel_rg ?? null,
    responsavel_rg_orgao: r.responsavel_rg_orgao ?? null,
    responsavel_telefone: r.responsavel_telefone ?? null,
    responsavel_email: r.responsavel_email ?? null,
    responsavel_parentesco: r.responsavel_parentesco ?? null,
    cep: r.cep,
    street: r.street,
    addr_number: r.addr_number,
    complement: r.complement ?? null,
    neighborhood: r.neighborhood,
    city: r.city,
    state: r.state,
    notes: r.notes ?? null,
    status: r.status as "ativo" | "inativo",
    since: formatSince(new Date(r.created_at)),
    lastContact: formatDate(new Date(r.created_at)),
    processes: r.process_count ?? 0,
    nis: r.nis ?? null,
    num_beneficio: r.num_beneficio ?? null,
    status_beneficio: r.status_beneficio ?? null,
    tipo_beneficio: r.tipo_beneficio ?? null,
    data_inicio_beneficio: r.data_inicio_beneficio
      ? String(r.data_inicio_beneficio).slice(0, 10)
      : null,
    valor_beneficio:
      r.valor_beneficio != null ? Number(r.valor_beneficio) : null,
    categoria_contribuinte: r.categoria_contribuinte ?? null,
    carencia_atingida: r.carencia_atingida ?? null,
    cid_principal: r.cid_principal ?? null,
    tipo_incapacidade: r.tipo_incapacidade ?? null,
    data_diagnostico: r.data_diagnostico
      ? String(r.data_diagnostico).slice(0, 10)
      : null,
    naturalidade_cidade: r.naturalidade_cidade ?? null,
    naturalidade_estado: r.naturalidade_estado ?? null,
    filiacao_mae: r.filiacao_mae ?? null,
    filiacao_pai: r.filiacao_pai ?? null,
    data_afastamento: r.data_afastamento
      ? String(r.data_afastamento).slice(0, 10)
      : null,
    atividade_anterior: r.atividade_anterior ?? null,
    num_contribuicoes:
      r.num_contribuicoes != null ? Number(r.num_contribuicoes) : null,
  };
}

export async function getClientFull(id: string): Promise<ClientFull | null> {
  // Try with new origin columns (requires migration 001 to be applied)
  try {
    const rows = await sql`
      SELECT
        c.id::text,
        c.type, c.name, c.doc, c.trade_name,
        to_char(c.birth_date, 'YYYY-MM-DD') AS birth_date,
        c.email, c.phone,
        c.rg, c.rg_orgao, c.estado_civil, c.genero, c.profissao,
        c.nacionalidade, c.senha_cliente, c.parceria,
        c.menor_incapaz,
        c.responsavel_nome, c.responsavel_cpf, c.responsavel_rg,
        c.responsavel_rg_orgao, c.responsavel_telefone,
        c.responsavel_email, c.responsavel_parentesco,
        c.cep, c.street, c.addr_number, c.complement,
        c.neighborhood, c.city, c.state, c.notes, c.status, c.created_at,
        c.origem_tipo, c.origem_texto,
        c.indicador_id::text,
        col.nome  AS indicador_nome,
        col.cargo AS indicador_cargo,
        c.indicador_tipo_trabalho,
        c.comissao_tipo,
        c.comissao_valor,
        c.nis, c.num_beneficio, c.status_beneficio, c.tipo_beneficio,
        to_char(c.data_inicio_beneficio, 'YYYY-MM-DD') AS data_inicio_beneficio,
        c.valor_beneficio, c.categoria_contribuinte, c.carencia_atingida,
        c.cid_principal, c.tipo_incapacidade,
        to_char(c.data_diagnostico, 'YYYY-MM-DD') AS data_diagnostico,
        c.naturalidade_cidade, c.naturalidade_estado,
        c.filiacao_mae, c.filiacao_pai,
        to_char(c.data_afastamento, 'YYYY-MM-DD') AS data_afastamento,
        c.atividade_anterior,
        c.num_contribuicoes,
        (SELECT COUNT(*)::int FROM processos WHERE client_id = c.id) AS process_count
      FROM clients c
      LEFT JOIN colaboradores col ON col.id = c.indicador_id
      WHERE c.id = ${id}::uuid
    `;
    if (rows.length === 0) return null;
    return mapClientFull(rows[0], true);
  } catch (e: unknown) {
    // Fall back to legacy query if new columns don't exist yet
    const code = (e as { code?: string }).code;
    if (code !== "42703") throw e;
  }

  const rows = await sql`
    SELECT
      c.id::text,
      c.type, c.name, c.doc, c.trade_name,
      to_char(c.birth_date, 'YYYY-MM-DD') AS birth_date,
      c.email, c.phone,
      c.rg, c.rg_orgao, c.estado_civil, c.genero, c.profissao,
      c.nacionalidade, c.senha_cliente, c.parceria,
      c.menor_incapaz,
      c.responsavel_nome, c.responsavel_cpf, c.responsavel_rg,
      c.responsavel_rg_orgao, c.responsavel_telefone,
      c.responsavel_email, c.responsavel_parentesco,
      c.cep, c.street, c.addr_number, c.complement,
      c.neighborhood, c.city, c.state, c.notes, c.status, c.created_at,
      c.nis, c.num_beneficio, c.status_beneficio, c.tipo_beneficio,
      to_char(c.data_inicio_beneficio, 'YYYY-MM-DD') AS data_inicio_beneficio,
      c.valor_beneficio, c.categoria_contribuinte, c.carencia_atingida,
      c.cid_principal, c.tipo_incapacidade,
      to_char(c.data_diagnostico, 'YYYY-MM-DD') AS data_diagnostico,
      c.naturalidade_cidade, c.naturalidade_estado,
      c.filiacao_mae, c.filiacao_pai,
      to_char(c.data_afastamento, 'YYYY-MM-DD') AS data_afastamento,
      c.atividade_anterior,
      c.num_contribuicoes,
      (SELECT COUNT(*)::int FROM processos WHERE client_id = c.id) AS process_count
    FROM clients c
    WHERE c.id = ${id}::uuid
  `;
  if (rows.length === 0) return null;
  return mapClientFull(rows[0], false);
}

export interface ClientOptionFull {
  id: string;
  name: string;
  doc: string;
  origem_tipo: string | null;
  indicador_id: string | null;
  indicador_nome: string | null;
  comissao_tipo: string | null;
  comissao_valor: number | null;
}

export async function getAllClientsWithOrigin(): Promise<ClientOptionFull[]> {
  try {
    const rows = await sql`
      SELECT
        c.id::text,
        c.name,
        c.doc,
        c.origem_tipo,
        c.indicador_id::text,
        col.nome AS indicador_nome,
        c.comissao_tipo,
        c.comissao_valor
      FROM clients c
      LEFT JOIN colaboradores col ON col.id = c.indicador_id
      WHERE c.deleted_at IS NULL
      ORDER BY c.name
    `;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      doc: r.doc,
      origem_tipo: r.origem_tipo ?? null,
      indicador_id: r.indicador_id ?? null,
      indicador_nome: r.indicador_nome ?? null,
      comissao_tipo: r.comissao_tipo ?? null,
      comissao_valor:
        r.comissao_valor != null ? Number(r.comissao_valor) : null,
    }));
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    if (code !== "42703") throw e;
  }
  // Fallback: new origin columns not yet migrated
  const rows = await sql`
    SELECT c.id::text, c.name, c.doc FROM clients c WHERE c.deleted_at IS NULL ORDER BY c.name
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    doc: r.doc,
    origem_tipo: null,
    indicador_id: null,
    indicador_nome: null,
    comissao_tipo: null,
    comissao_valor: null,
  }));
}

// ── Birthday clients ──────────────────────────────────────────────────────────

export interface BirthdayClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  birth_date: string; // YYYY-MM-DD
}

export async function getClientsWithBirthdays(): Promise<BirthdayClient[]> {
  const rows = await sql`
    SELECT id::text, name, email, phone,
           TO_CHAR(birth_date, 'YYYY-MM-DD') AS birth_date
    FROM clients
    WHERE birth_date IS NOT NULL AND type = 'PF' AND deleted_at IS NULL
    ORDER BY
      EXTRACT(MONTH FROM birth_date),
      EXTRACT(DAY FROM birth_date),
      name
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email ?? "",
    phone: r.phone ?? "",
    birth_date: r.birth_date,
  }));
}

export async function getClientById(id: string): Promise<Client | null> {
  const rows = await sql`
    SELECT
      c.id::text,
      c.type,
      c.name,
      c.doc,
      c.trade_name,
      c.email,
      c.phone,
      c.city,
      c.state,
      c.status,
      c.created_at,
      (SELECT COUNT(*)::int FROM processos WHERE client_id = c.id) AS process_count
    FROM clients c
    WHERE c.id = ${id}::uuid
  `;

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    type: r.type as "PF" | "PJ",
    name: r.name,
    doc: r.doc,
    trade_name: r.trade_name ?? null,
    email: r.email,
    phone: r.phone,
    city: r.city,
    state: r.state,
    status: r.status as "ativo" | "inativo",
    since: formatSince(new Date(r.created_at)),
    lastContact: formatDate(new Date(r.created_at)),
    processes: r.process_count ?? 0,
  };
}
