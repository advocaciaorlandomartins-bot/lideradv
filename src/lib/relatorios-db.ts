import sql from "./db";

export interface RelatorioLancamento {
  id: string;
  tipo: string;
  categoria: string | null;
  descricao: string;
  valor: number;
  status: string;
  data_vencimento: string;
  data_pagamento: string | null;
  client_name: string | null;
  processo_tipo: string | null;
  remuneracao_id: string | null;
  created_at: string;
}

export interface RelatorioColaborador {
  id: string;
  tipo: string;
  categoria: string | null;
  descricao: string;
  valor: number;
  status: string;
  data_vencimento: string;
  data_pagamento: string | null;
  colaborador_nome: string | null;
  colaborador_cargo: string | null;
  origem_client_name: string | null;
  fonte: string;
}

export interface RelatorioResumo {
  total_entradas: number;
  total_saidas: number;
  total_remuneracoes: number;
  pendente_entradas: number;
  pendente_saidas: number;
  saldo_liquido: number;
  count_lancamentos: number;
}

export interface RelatorioClienteItem {
  client_id: string;
  client_name: string;
  total_entradas: number;
  total_saidas: number;
  lancamentos: RelatorioLancamento[];
}

export async function getRelatorioLancamentos(filters: {
  dataInicio?: string;
  dataFim?: string;
  tipo?: string;
  status?: string;
}): Promise<RelatorioLancamento[]> {
  const { dataInicio, dataFim, tipo, status } = filters;
  const rows = await sql`
    SELECT
      l.id::text,
      l.tipo,
      l.categoria,
      l.descricao,
      l.valor,
      l.status,
      to_char(l.data_vencimento, 'DD/MM/YYYY') AS data_vencimento,
      to_char(l.data_pagamento,  'DD/MM/YYYY') AS data_pagamento,
      c.name  AS client_name,
      p.tipo_acao AS processo_tipo,
      l.remuneracao_id::text,
      l.created_at
    FROM lancamentos l
    LEFT JOIN clients   c ON c.id = l.client_id
    LEFT JOIN processos p ON p.id = l.processo_id
    WHERE l.status != 'cancelado'
      AND (${dataInicio ?? null}::date IS NULL OR l.data_vencimento >= ${dataInicio ?? null}::date)
      AND (${dataFim ?? null}::date IS NULL    OR l.data_vencimento <= ${dataFim ?? null}::date)
      AND (${tipo ?? null}::text IS NULL        OR l.tipo = ${tipo ?? null}::text)
      AND (${status ?? null}::text IS NULL     OR l.status = ${status ?? null}::text)
    ORDER BY l.data_vencimento DESC, l.created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    categoria: r.categoria ?? null,
    descricao: r.descricao,
    valor: Number(r.valor),
    status: r.status,
    data_vencimento: r.data_vencimento,
    data_pagamento: r.data_pagamento ?? null,
    client_name: r.client_name ?? null,
    processo_tipo: r.processo_tipo ?? null,
    remuneracao_id: r.remuneracao_id ?? null,
    created_at: new Date(r.created_at).toLocaleDateString("pt-BR"),
  }));
}

export async function getRelatorioByCliente(
  clientId: string
): Promise<RelatorioLancamento[]> {
  const rows = await sql`
    SELECT
      l.id::text,
      l.tipo,
      l.categoria,
      l.descricao,
      l.valor,
      l.status,
      to_char(l.data_vencimento, 'DD/MM/YYYY') AS data_vencimento,
      to_char(l.data_pagamento,  'DD/MM/YYYY') AS data_pagamento,
      c.name  AS client_name,
      p.tipo_acao AS processo_tipo,
      l.remuneracao_id::text,
      l.created_at
    FROM lancamentos l
    LEFT JOIN clients   c ON c.id = l.client_id
    LEFT JOIN processos p ON p.id = l.processo_id
    WHERE l.client_id = ${clientId}::uuid
      AND l.status != 'cancelado'
    ORDER BY l.data_vencimento DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    categoria: r.categoria ?? null,
    descricao: r.descricao,
    valor: Number(r.valor),
    status: r.status,
    data_vencimento: r.data_vencimento,
    data_pagamento: r.data_pagamento ?? null,
    client_name: r.client_name ?? null,
    processo_tipo: r.processo_tipo ?? null,
    remuneracao_id: r.remuneracao_id ?? null,
    created_at: new Date(r.created_at).toLocaleDateString("pt-BR"),
  }));
}

export async function getRelatorioByColaborador(
  colaboradorId: string
): Promise<RelatorioColaborador[]> {
  const rows = await sql`
    SELECT
      l.id::text,
      l.tipo,
      l.categoria,
      l.descricao,
      l.valor,
      l.status,
      to_char(l.data_vencimento, 'DD/MM/YYYY') AS data_vencimento,
      to_char(l.data_pagamento,  'DD/MM/YYYY') AS data_pagamento,
      col.nome   AS colaborador_nome,
      col.cargo  AS colaborador_cargo,
      oc.name    AS origem_client_name,
      CASE
        WHEN l.remuneracao_id IS NOT NULL      THEN 'Remuneração'
        WHEN l.origem_client_id IS NOT NULL    THEN 'Comissão de Indicação'
        ELSE 'Pagamento'
      END AS fonte
    FROM lancamentos l
    LEFT JOIN remuneracoes r  ON r.id   = l.remuneracao_id
    LEFT JOIN colaboradores col ON col.id = r.colaborador_id
    LEFT JOIN clients oc      ON oc.id  = l.origem_client_id
    WHERE col.id = ${colaboradorId}::uuid
      AND l.status != 'cancelado'
    ORDER BY l.data_vencimento DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    categoria: r.categoria ?? null,
    descricao: r.descricao,
    valor: Number(r.valor),
    status: r.status,
    data_vencimento: r.data_vencimento,
    data_pagamento: r.data_pagamento ?? null,
    colaborador_nome: r.colaborador_nome ?? null,
    colaborador_cargo: r.colaborador_cargo ?? null,
    origem_client_name: r.origem_client_name ?? null,
    fonte: r.fonte,
  }));
}

export async function getRelatorioResumo(filters: {
  dataInicio?: string;
  dataFim?: string;
}): Promise<RelatorioResumo> {
  const { dataInicio, dataFim } = filters;
  const rows = await sql`
    SELECT
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'pago'),     0) AS total_entradas,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'   AND status = 'pago'),     0) AS total_saidas,
      COALESCE(SUM(valor) FILTER (WHERE remuneracao_id IS NOT NULL AND status = 'pago'), 0) AS total_remuneracoes,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'pendente'), 0) AS pendente_entradas,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'   AND status = 'pendente'), 0) AS pendente_saidas,
      COUNT(*) FILTER (WHERE status != 'cancelado') AS count_lancamentos
    FROM lancamentos
    WHERE status != 'cancelado'
      AND (${dataInicio ?? null}::date IS NULL OR data_vencimento >= ${dataInicio ?? null}::date)
      AND (${dataFim ?? null}::date IS NULL    OR data_vencimento <= ${dataFim ?? null}::date)
  `;
  const r = rows[0];
  const entradas = Number(r.total_entradas);
  const saidas = Number(r.total_saidas);
  return {
    total_entradas: entradas,
    total_saidas: saidas,
    total_remuneracoes: Number(r.total_remuneracoes),
    pendente_entradas: Number(r.pendente_entradas),
    pendente_saidas: Number(r.pendente_saidas),
    saldo_liquido: entradas - saidas,
    count_lancamentos: Number(r.count_lancamentos),
  };
}

export interface ClienteOption {
  id: string;
  name: string;
}

export interface ColaboradorOption {
  id: string;
  nome: string;
  cargo: string;
}

// ── Remunerações com fonte de renda ──────────────────────────────────────────

export interface RelatorioRemuneracao {
  id: string;
  colaborador_id: string;
  colaborador_nome: string;
  colaborador_cargo: string;
  tipo: string;
  valor: number;
  competencia: string | null;
  data_pagamento: string | null;
  status: string;
  descricao: string | null;
  fonte: string;
  client_nome: string | null;
  processo_tipo: string | null;
}

export async function getRelatorioRemuneracoes(filters: {
  colaboradorId?: string;
  dataInicio?: string;
  dataFim?: string;
  tipo?: string;
  status?: string;
}): Promise<RelatorioRemuneracao[]> {
  const { colaboradorId, dataInicio, dataFim, tipo, status } = filters;
  const rows = await sql`
    SELECT
      r.id::text,
      r.colaborador_id::text,
      co.nome                                   AS colaborador_nome,
      co.cargo                                  AS colaborador_cargo,
      r.tipo,
      r.valor,
      to_char(r.competencia,    'MM/YYYY')      AS competencia,
      to_char(r.data_pagamento, 'DD/MM/YYYY')   AS data_pagamento,
      r.status,
      r.descricao,
      cl.name                                   AS client_nome,
      p.tipo_acao                               AS processo_tipo,
      CASE
        WHEN r.client_id IS NOT NULL
          THEN 'Cliente: ' || COALESCE(cl.name, '—')
        WHEN r.processo_id IS NOT NULL
          THEN 'Processo: ' || COALESCE(p.tipo_acao, 'vinculado')
        ELSE 'Escritório'
      END AS fonte
    FROM remuneracoes r
    JOIN colaboradores co ON co.id = r.colaborador_id
    LEFT JOIN clients   cl ON cl.id = r.client_id
    LEFT JOIN processos p  ON p.id  = r.processo_id
    WHERE r.status != 'cancelado'
      AND (${colaboradorId ?? null}::uuid IS NULL OR r.colaborador_id = ${colaboradorId ?? null}::uuid)
      AND (${tipo ?? null}::text IS NULL         OR r.tipo    = ${tipo ?? null}::text)
      AND (${status ?? null}::text IS NULL       OR r.status  = ${status ?? null}::text)
      AND (${dataInicio ?? null}::date IS NULL   OR r.competencia >= ${dataInicio ?? null}::date)
      AND (${dataFim ?? null}::date IS NULL      OR r.competencia <= ${dataFim ?? null}::date)
    ORDER BY co.nome ASC, r.created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    colaborador_id: r.colaborador_id,
    colaborador_nome: r.colaborador_nome,
    colaborador_cargo: r.colaborador_cargo,
    tipo: r.tipo,
    valor: Number(r.valor),
    competencia: r.competencia ?? null,
    data_pagamento: r.data_pagamento ?? null,
    status: r.status,
    descricao: r.descricao ?? null,
    fonte: r.fonte,
    client_nome: r.client_nome ?? null,
    processo_tipo: r.processo_tipo ?? null,
  }));
}

// ── Fluxo mensal ─────────────────────────────────────────────────────────────

export interface FluxoMensal {
  mes_iso: string;
  mes_label: string;
  receitas: number;
  despesas: number;
  a_receber: number;
  a_pagar: number;
  saldo: number;
}

export async function getFluxoMensal(meses = 12): Promise<FluxoMensal[]> {
  const rows = await sql`
    SELECT
      to_char(data_vencimento, 'YYYY-MM')   AS mes_iso,
      to_char(data_vencimento, 'MM/YYYY')   AS mes_label,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'pago'),     0) AS receitas,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'   AND status = 'pago'),     0) AS despesas,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'pendente'), 0) AS a_receber,
      COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'   AND status = 'pendente'), 0) AS a_pagar
    FROM lancamentos
    WHERE status != 'cancelado'
      AND data_vencimento >= (NOW() - (${meses} || ' months')::interval)::date
    GROUP BY mes_iso, mes_label
    ORDER BY mes_iso ASC
  `;
  return rows.map((r) => {
    const saldoMes = Number(r.receitas) - Number(r.despesas);
    return {
      mes_iso: r.mes_iso,
      mes_label: r.mes_label,
      receitas: Number(r.receitas),
      despesas: Number(r.despesas),
      a_receber: Number(r.a_receber),
      a_pagar: Number(r.a_pagar),
      saldo: saldoMes,
    };
  });
}

export async function getClientesParaRelatorio(): Promise<ClienteOption[]> {
  const rows =
    await sql`SELECT id::text, name FROM clients WHERE deleted_at IS NULL ORDER BY name ASC`;
  return rows.map((r) => ({ id: r.id, name: r.name }));
}

export interface ClienteParaRecibo {
  id: string;
  name: string;
  doc: string;
  phone: string;
  city: string;
  state: string;
  type: string;
}

export async function getClientesParaRecibo(): Promise<ClienteParaRecibo[]> {
  const rows = await sql`
    SELECT id::text, name, doc, phone, city, state, type
    FROM clients
    WHERE deleted_at IS NULL
    ORDER BY name ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    doc: r.doc ?? "",
    phone: r.phone ?? "",
    city: r.city ?? "",
    state: r.state ?? "",
    type: r.type ?? "PF",
  }));
}

export async function getColaboradoresParaRelatorio(): Promise<
  ColaboradorOption[]
> {
  const rows =
    await sql`SELECT id::text, nome, cargo FROM colaboradores WHERE status = 'ativo' ORDER BY nome ASC`;
  return rows.map((r) => ({ id: r.id, nome: r.nome, cargo: r.cargo }));
}

// ── Relatório Jurídico ────────────────────────────────────────────────────────

export interface RelatorioJuridicoArea {
  area: string;
  total: number;
  ativos: number;
  ganhos: number;
  perdidos: number;
  acordo: number;
  taxa_exito: number;
}

export interface RelatorioJuridicoControle {
  total: number;
  concluidos_no_prazo: number;
  concluidos_atrasados: number;
  pendentes: number;
  vencidos: number;
  compliance_pct: number;
}

export interface RelatorioJuridico {
  por_area: RelatorioJuridicoArea[];
  controles: RelatorioJuridicoControle;
  processos_por_status: { status: string; total: number }[];
  total_processos: number;
  total_clientes: number;
  novos_clientes_mes: number;
}

export async function getRelatorioJuridico(): Promise<RelatorioJuridico> {
  const [areaRows, controleRows, statusRows, totaisRows] = await Promise.all([
    sql`
      SELECT
        COALESCE(area, 'Não definida') AS area,
        COUNT(*)                        AS total,
        COUNT(*) FILTER (WHERE status = 'ativo')  AS ativos,
        COUNT(*) FILTER (
          WHERE resultado IN ('ganho','procedente','procedente_parcial','favoravel')
             OR resultado_judicial IN ('ganho','procedente','procedente_parcial','favoravel')
        ) AS ganhos,
        COUNT(*) FILTER (
          WHERE resultado IN ('perda','improcedente','desfavoravel')
             OR resultado_judicial IN ('perda','improcedente','desfavoravel')
        ) AS perdidos,
        COUNT(*) FILTER (
          WHERE resultado IN ('acordo','homologado')
             OR resultado_judicial IN ('acordo','homologado')
        ) AS acordo
      FROM processos
      WHERE deleted_at IS NULL
      GROUP BY area
      ORDER BY total DESC
    `,
    sql`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE status = 'concluido'
            AND (
              (prazo_interno IS NOT NULL AND updated_at::date <= prazo_interno)
              OR (prazo_interno IS NULL AND data_evento IS NOT NULL AND updated_at::date <= data_evento)
              OR (prazo_interno IS NULL AND data_evento IS NULL)
            )
        ) AS concluidos_no_prazo,
        COUNT(*) FILTER (
          WHERE status = 'concluido'
            AND (
              (prazo_interno IS NOT NULL AND updated_at::date > prazo_interno)
              OR (prazo_interno IS NULL AND data_evento IS NOT NULL AND updated_at::date > data_evento)
            )
        ) AS concluidos_atrasados,
        COUNT(*) FILTER (
          WHERE status NOT IN ('concluido','cancelado')
            AND COALESCE(prazo_interno, data_evento) >= CURRENT_DATE
        ) AS pendentes,
        COUNT(*) FILTER (
          WHERE status NOT IN ('concluido','cancelado')
            AND COALESCE(prazo_interno, data_evento) < CURRENT_DATE
        ) AS vencidos
      FROM controles
    `,
    sql`
      SELECT status, COUNT(*)::int AS total
      FROM processos
      WHERE deleted_at IS NULL
      GROUP BY status
      ORDER BY total DESC
    `,
    sql`
      SELECT
        (SELECT COUNT(*) FROM processos WHERE deleted_at IS NULL)::int AS total_processos,
        (SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL)::int AS total_clientes,
        (SELECT COUNT(*) FROM clients WHERE deleted_at IS NULL AND created_at >= date_trunc('month', CURRENT_DATE))::int AS novos_clientes_mes
    `,
  ]);

  const por_area: RelatorioJuridicoArea[] = areaRows.map((r) => {
    const total = Number(r.total);
    const ganhos = Number(r.ganhos);
    const perdidos = Number(r.perdidos);
    const encerrados = ganhos + perdidos + Number(r.acordo);
    return {
      area: r.area as string,
      total,
      ativos: Number(r.ativos),
      ganhos,
      perdidos,
      acordo: Number(r.acordo),
      taxa_exito: encerrados > 0 ? Math.round((ganhos / encerrados) * 100) : 0,
    };
  });

  const cr = controleRows[0] as Record<string, unknown>;
  const totalControles = Number(cr.total);
  const concluidos_no_prazo = Number(cr.concluidos_no_prazo);
  const concluidos_atrasados = Number(cr.concluidos_atrasados);
  const totalConcluidos = concluidos_no_prazo + concluidos_atrasados;
  const controles: RelatorioJuridicoControle = {
    total: totalControles,
    concluidos_no_prazo,
    concluidos_atrasados,
    pendentes: Number(cr.pendentes),
    vencidos: Number(cr.vencidos),
    compliance_pct:
      totalConcluidos > 0
        ? Math.round((concluidos_no_prazo / totalConcluidos) * 100)
        : 100,
  };

  const tr = totaisRows[0] as Record<string, unknown>;

  return {
    por_area,
    controles,
    processos_por_status: statusRows.map((r) => ({
      status: r.status as string,
      total: Number(r.total),
    })),
    total_processos: Number(tr.total_processos),
    total_clientes: Number(tr.total_clientes),
    novos_clientes_mes: Number(tr.novos_clientes_mes),
  };
}
