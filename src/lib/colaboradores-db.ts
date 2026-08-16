import sql from "./db";
import type { CargoColaborador } from "./colaboradores-types";
export type { CargoColaborador } from "./colaboradores-types";
export { CARGO_LABELS, CARGO_COLORS } from "./colaboradores-types";

export interface Colaborador {
  id: string;
  nome: string;
  cargo: CargoColaborador;
  email: string | null;
  telefone: string | null;
  oab: string | null;
  salario_mensal: number | null;
  data_admissao: string | null;
  data_demissao: string | null;
  status: "ativo" | "inativo";
  observacoes: string | null;
  created_at_formatted: string;
  /** % sobre o honorário quando o colaborador atuou só na fase administrativa. */
  comissao_administrativo_pct: number | null;
  /** % sobre o honorário quando o colaborador atuou só na fase judicial. */
  comissao_judicial_pct: number | null;
  /** % sobre o honorário quando o colaborador atuou nas duas fases. */
  comissao_ambos_pct: number | null;
}

export interface ColaboradorFull extends Colaborador {
  data_admissao_iso: string | null;
  data_demissao_iso: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Colaborador {
  return {
    id: r.id,
    nome: r.nome,
    cargo: r.cargo as CargoColaborador,
    email: r.email ?? null,
    telefone: r.telefone ?? null,
    oab: r.oab ?? null,
    salario_mensal: r.salario_mensal != null ? Number(r.salario_mensal) : null,
    data_admissao: r.data_admissao ?? null,
    data_demissao: r.data_demissao ?? null,
    status: r.status as "ativo" | "inativo",
    observacoes: r.observacoes ?? null,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
    comissao_administrativo_pct:
      r.comissao_administrativo_pct != null
        ? Number(r.comissao_administrativo_pct)
        : null,
    comissao_judicial_pct:
      r.comissao_judicial_pct != null ? Number(r.comissao_judicial_pct) : null,
    comissao_ambos_pct:
      r.comissao_ambos_pct != null ? Number(r.comissao_ambos_pct) : null,
  };
}

export async function getAllColaboradores(): Promise<Colaborador[]> {
  const rows = await sql`
    SELECT
      id::text,
      nome,
      cargo,
      email,
      telefone,
      oab,
      salario_mensal,
      to_char(data_admissao, 'DD/MM/YYYY') AS data_admissao,
      to_char(data_demissao, 'DD/MM/YYYY') AS data_demissao,
      status,
      observacoes,
      comissao_administrativo_pct,
      comissao_judicial_pct,
      comissao_ambos_pct,
      created_at
    FROM colaboradores
    ORDER BY nome ASC
  `;
  return rows.map(mapRow);
}

export async function getColaboradorFull(
  id: string
): Promise<ColaboradorFull | null> {
  const rows = await sql`
    SELECT
      id::text,
      nome,
      cargo,
      email,
      telefone,
      oab,
      salario_mensal,
      to_char(data_admissao, 'DD/MM/YYYY')  AS data_admissao,
      to_char(data_admissao, 'YYYY-MM-DD')  AS data_admissao_iso,
      to_char(data_demissao, 'DD/MM/YYYY')  AS data_demissao,
      to_char(data_demissao, 'YYYY-MM-DD')  AS data_demissao_iso,
      status,
      observacoes,
      comissao_administrativo_pct,
      comissao_judicial_pct,
      comissao_ambos_pct,
      created_at
    FROM colaboradores
    WHERE id = ${id}::uuid
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    ...mapRow(r),
    data_admissao_iso: r.data_admissao_iso ?? null,
    data_demissao_iso: r.data_demissao_iso ?? null,
  };
}
