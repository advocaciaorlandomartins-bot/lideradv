import sql from "./db";

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
  valor_causa: number | null;
  status: "ativo" | "em_andamento" | "arquivado" | "encerrado";
  data_distribuicao: string | null;
  created_at_formatted: string;
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
    valor_causa: r.valor_causa ? Number(r.valor_causa) : null,
    status: r.status as "ativo" | "arquivado" | "encerrado",
    data_distribuicao: r.data_distribuicao ?? null,
    created_at_formatted: formatDate(new Date(r.created_at)),
  };
}

export async function getAllProcessos(): Promise<Processo[]> {
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
      p.created_at
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    ORDER BY p.created_at DESC
  `;
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
      p.created_at
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = ${id}::uuid
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
      p.created_at
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    WHERE p.id = ${id}::uuid
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
      p.valor_causa,
      p.status,
      to_char(p.data_distribuicao, 'DD/MM/YYYY') AS data_distribuicao,
      p.created_at
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    WHERE p.client_id = ${clientId}::uuid
    ORDER BY p.created_at DESC
  `;
  return rows.map(mapRow);
}
