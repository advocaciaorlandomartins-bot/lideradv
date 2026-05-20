import sql from "./db";
import type { TipoRemuneracao, StatusRemuneracao } from "./remuneracoes-types";
export type { TipoRemuneracao, StatusRemuneracao } from "./remuneracoes-types";
export { TIPO_LABELS, TIPO_COLORS, TIPO_DESCS } from "./remuneracoes-types";

export interface Remuneracao {
  id: string;
  colaborador_id: string;
  colaborador_nome: string;
  colaborador_cargo: string;
  tipo: TipoRemuneracao;
  valor: number;
  competencia: string | null;
  competencia_iso: string | null;
  data_pagamento: string | null;
  status: StatusRemuneracao;
  descricao: string | null;
  processo_id: string | null;
  processo_tipo: string | null;
  created_at_formatted: string;
}

export interface RemuneracaoKpis {
  aPagar: number;
  pago: number;
  salarios: number;
  comissoes: number;
  bonificacoes: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Remuneracao {
  return {
    id: r.id,
    colaborador_id: r.colaborador_id,
    colaborador_nome: r.colaborador_nome,
    colaborador_cargo: r.colaborador_cargo,
    tipo: r.tipo as TipoRemuneracao,
    valor: Number(r.valor),
    competencia: r.competencia ?? null,
    competencia_iso: r.competencia_iso ?? null,
    data_pagamento: r.data_pagamento ?? null,
    status: r.status as StatusRemuneracao,
    descricao: r.descricao ?? null,
    processo_id: r.processo_id ?? null,
    processo_tipo: r.processo_tipo ?? null,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
  };
}

export async function getAllRemuneracoes(): Promise<Remuneracao[]> {
  const rows = await sql`
    SELECT
      r.id::text,
      r.colaborador_id::text,
      co.nome              AS colaborador_nome,
      co.cargo             AS colaborador_cargo,
      r.tipo,
      r.valor,
      to_char(r.competencia,    'MM/YYYY')    AS competencia,
      to_char(r.competencia,    'YYYY-MM')    AS competencia_iso,
      to_char(r.data_pagamento, 'DD/MM/YYYY') AS data_pagamento,
      r.status,
      r.descricao,
      r.processo_id::text,
      p.tipo_acao          AS processo_tipo,
      r.created_at
    FROM remuneracoes r
    JOIN colaboradores co ON co.id = r.colaborador_id
    LEFT JOIN processos p ON p.id = r.processo_id
    ORDER BY r.created_at DESC
  `;
  return rows.map(mapRow);
}

export async function getRemuneracaoKpis(): Promise<RemuneracaoKpis> {
  const rows = await sql`
    SELECT
      COALESCE(SUM(valor) FILTER (WHERE status = 'pendente'), 0)     AS a_pagar,
      COALESCE(SUM(valor) FILTER (WHERE status = 'pago'),     0)     AS pago,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'salario'),    0)     AS salarios,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'comissao'),   0)     AS comissoes,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'bonificacao'),0)     AS bonificacoes
    FROM remuneracoes
  `;
  const r = rows[0];
  return {
    aPagar: Number(r.a_pagar),
    pago: Number(r.pago),
    salarios: Number(r.salarios),
    comissoes: Number(r.comissoes),
    bonificacoes: Number(r.bonificacoes),
  };
}
