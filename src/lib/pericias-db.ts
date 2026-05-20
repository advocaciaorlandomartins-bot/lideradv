import sql from "./db";
import type { TipoPericia } from "./pericias-types";
export type { TipoPericia } from "./pericias-types";
export { TIPO_LABELS, TIPO_COLORS } from "./pericias-types";

export interface Pericia {
  id: string;
  tipo: TipoPericia;
  client_id: string;
  client_name: string;
  processo_id: string | null;
  processo_tipo: string | null;
  data_pericia: string;
  hora_pericia: string | null;
  local_pericia: string | null;
  perito: string | null;
  especialidade: string | null;
  status: "agendado" | "realizado" | "cancelado" | "remarcado";
  resultado: "favoravel" | "desfavoravel" | "pendente" | "inconclusivo" | null;
  created_at_formatted: string;
}

export interface PericiaFull extends Pericia {
  beneficio_numero: string | null;
  beneficio_tipo: string | null;
  data_fim_beneficio: string | null;
  nova_data_fim: string | null;
  data_fim_beneficio_iso: string | null;
  nova_data_fim_iso: string | null;
  data_pericia_iso: string;
  observacoes: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Pericia {
  return {
    id: r.id,
    tipo: r.tipo as TipoPericia,
    client_id: r.client_id,
    client_name: r.client_name,
    processo_id: r.processo_id ?? null,
    processo_tipo: r.processo_tipo ?? null,
    data_pericia: r.data_pericia,
    hora_pericia: r.hora_pericia ?? null,
    local_pericia: r.local_pericia ?? null,
    perito: r.perito ?? null,
    especialidade: r.especialidade ?? null,
    status: r.status as Pericia["status"],
    resultado: r.resultado ?? null,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
  };
}

export async function getAllPericias(): Promise<Pericia[]> {
  const rows = await sql`
    SELECT
      pe.id::text,
      pe.tipo,
      pe.client_id::text,
      c.name  AS client_name,
      pe.processo_id::text,
      p.tipo_acao AS processo_tipo,
      to_char(pe.data_pericia, 'DD/MM/YYYY') AS data_pericia,
      to_char(pe.hora_pericia, 'HH24:MI')    AS hora_pericia,
      pe.local_pericia,
      pe.perito,
      pe.especialidade,
      pe.status,
      pe.resultado,
      pe.created_at
    FROM pericias pe
    JOIN clients   c ON c.id = pe.client_id
    LEFT JOIN processos p ON p.id = pe.processo_id
    ORDER BY pe.data_pericia ASC, pe.hora_pericia ASC NULLS LAST
  `;
  return rows.map(mapRow);
}

export async function getPericiaFull(id: string): Promise<PericiaFull | null> {
  const rows = await sql`
    SELECT
      pe.id::text,
      pe.tipo,
      pe.client_id::text,
      c.name  AS client_name,
      pe.processo_id::text,
      p.tipo_acao AS processo_tipo,
      to_char(pe.data_pericia, 'DD/MM/YYYY')    AS data_pericia,
      to_char(pe.data_pericia, 'YYYY-MM-DD')    AS data_pericia_iso,
      to_char(pe.hora_pericia, 'HH24:MI')       AS hora_pericia,
      pe.local_pericia,
      pe.perito,
      pe.especialidade,
      pe.status,
      pe.resultado,
      pe.beneficio_numero,
      pe.beneficio_tipo,
      to_char(pe.data_fim_beneficio, 'DD/MM/YYYY') AS data_fim_beneficio,
      to_char(pe.data_fim_beneficio, 'YYYY-MM-DD') AS data_fim_beneficio_iso,
      to_char(pe.nova_data_fim,      'DD/MM/YYYY') AS nova_data_fim,
      to_char(pe.nova_data_fim,      'YYYY-MM-DD') AS nova_data_fim_iso,
      pe.observacoes,
      pe.created_at
    FROM pericias pe
    JOIN clients   c ON c.id = pe.client_id
    LEFT JOIN processos p ON p.id = pe.processo_id
    WHERE pe.id = ${id}::uuid
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...mapRow(r),
    data_pericia_iso: r.data_pericia_iso,
    beneficio_numero: r.beneficio_numero ?? null,
    beneficio_tipo: r.beneficio_tipo ?? null,
    data_fim_beneficio: r.data_fim_beneficio ?? null,
    data_fim_beneficio_iso: r.data_fim_beneficio_iso ?? null,
    nova_data_fim: r.nova_data_fim ?? null,
    nova_data_fim_iso: r.nova_data_fim_iso ?? null,
    observacoes: r.observacoes ?? null,
  };
}
