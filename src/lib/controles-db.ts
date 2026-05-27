import sql from "./db";
import {
  dbStatusToKey,
  type Controle,
  type ClienteOption,
  type ProcessoOption,
  type UsuarioOption,
} from "./controles-types";

export type {
  Controle,
  ClienteOption,
  ProcessoOption,
  UsuarioOption,
} from "./controles-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Controle {
  return {
    id: String(r.id),
    tipo: r.tipo,
    data_evento: r.data_evento ? String(r.data_evento).slice(0, 10) : null,
    descricao: String(r.descricao),
    status: dbStatusToKey(r.status),
    cliente_id: r.cliente_id ? String(r.cliente_id) : null,
    cliente_nome: r.cliente_nome ? String(r.cliente_nome) : null,
    processo_id: r.processo_id ? String(r.processo_id) : null,
    processo_numero: r.processo_numero ? String(r.processo_numero) : null,
    responsavel_id: r.responsavel_id ? String(r.responsavel_id) : null,
    responsavel_login: r.responsavel_login ? String(r.responsavel_login) : null,
    tipo_demanda: r.tipo_demanda ? String(r.tipo_demanda) : null,
    observacoes: r.observacoes ? String(r.observacoes) : null,
    created_at: String(r.created_at),
  };
}

export interface GetControlesOptions {
  tipo: string;
  status?: string | null; // 'pendente' | 'concluido' | 'cancelado' | null (all)
  inicio?: string | null;
  fim?: string | null;
  ordem?: "asc" | "desc";
  pagina?: number;
  rpp?: number;
}

export async function getControles(
  options: GetControlesOptions
): Promise<{ controles: Controle[]; total: number }> {
  const {
    tipo,
    status,
    inicio,
    fim,
    ordem = "desc",
    pagina = 1,
    rpp = 20,
  } = options;

  const statusParam: string | null =
    status === "pendente" || status === "concluido" || status === "cancelado"
      ? status
      : null;

  const inicioParam = inicio || null;
  const fimParam = fim || null;

  const rows = await sql`
    SELECT
      c.id::text, c.tipo, c.data_evento::text, c.descricao, c.status::text,
      c.cliente_id::text,   cl.name AS cliente_nome,
      c.processo_id::text,  p.numero AS processo_numero,
      c.responsavel_id::text, u.login AS responsavel_login,
      c.tipo_demanda, c.observacoes, c.created_at::text
    FROM controles c
    LEFT JOIN clients cl ON cl.id = c.cliente_id
    LEFT JOIN processos p  ON p.id  = c.processo_id
    LEFT JOIN usuarios u   ON u.id  = c.responsavel_id
    WHERE c.tipo = ${tipo}
      AND CASE
            WHEN ${statusParam}::text IS NULL          THEN TRUE
            WHEN ${statusParam}  = 'pendente'  THEN c.status IS NULL
            WHEN ${statusParam} != 'pendente'  THEN c.status = ${statusParam}
            ELSE TRUE
          END
      AND (${inicioParam}::date IS NULL OR c.data_evento >= ${inicioParam}::date)
      AND (${fimParam}::date   IS NULL OR c.data_evento <= ${fimParam}::date)
    ORDER BY c.data_evento ${ordem === "asc" ? sql`ASC` : sql`DESC`} NULLS LAST,
             c.created_at DESC
    LIMIT ${rpp} OFFSET ${(pagina - 1) * rpp}
  `;

  const countRows = await sql`
    SELECT COUNT(*)::int AS n
    FROM controles c
    WHERE c.tipo = ${tipo}
      AND CASE
            WHEN ${statusParam}::text IS NULL          THEN TRUE
            WHEN ${statusParam}  = 'pendente'  THEN c.status IS NULL
            WHEN ${statusParam} != 'pendente'  THEN c.status = ${statusParam}
            ELSE TRUE
          END
      AND (${inicioParam}::date IS NULL OR c.data_evento >= ${inicioParam}::date)
      AND (${fimParam}::date   IS NULL OR c.data_evento <= ${fimParam}::date)
  `;

  return {
    controles: rows.map(mapRow),
    total: Number(countRows[0]?.n ?? 0),
  };
}

export async function getControleById(id: string): Promise<Controle | null> {
  const rows = await sql`
    SELECT
      c.id::text, c.tipo, c.data_evento::text, c.descricao, c.status::text,
      c.cliente_id::text,   cl.name AS cliente_nome,
      c.processo_id::text,  p.numero AS processo_numero,
      c.responsavel_id::text, u.login AS responsavel_login,
      c.tipo_demanda, c.observacoes, c.created_at::text
    FROM controles c
    LEFT JOIN clients cl ON cl.id = c.cliente_id
    LEFT JOIN processos p  ON p.id  = c.processo_id
    LEFT JOIN usuarios u   ON u.id  = c.responsavel_id
    WHERE c.id = ${id}::uuid
    LIMIT 1
  `;
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function getClientesForControle(): Promise<ClienteOption[]> {
  const rows = await sql`
    SELECT id::text, name AS nome, COALESCE(doc, '') AS doc
    FROM clients
    WHERE status = 'ativo'
    ORDER BY name ASC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    nome: String(r.nome),
    doc: String(r.doc),
  }));
}

export async function getProcessosForControle(): Promise<ProcessoOption[]> {
  const rows = await sql`
    SELECT id::text, COALESCE(numero, tipo_acao) AS numero, client_id::text AS cliente_id
    FROM processos
    WHERE status = 'ativo'
    ORDER BY numero ASC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    numero: String(r.numero),
    cliente_id: String(r.cliente_id),
  }));
}

export async function getUsuariosForControle(): Promise<UsuarioOption[]> {
  const rows = await sql`
    SELECT id::text, login, nome
    FROM usuarios
    WHERE ativo = TRUE
    ORDER BY nome ASC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    login: String(r.login),
    nome: String(r.nome),
  }));
}
