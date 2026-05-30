import sql from "./db";
import { TIPOS_CONTROLE } from "./controles-types";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FinanceiroKpis {
  recebidoMes: number;
  pagoMes: number;
  saldoMes: number;
  aReceber: number;
  aPagar: number;
  recebidoAno: number;
  pagoAno: number;
  vencidosValor: number;
  vencidosCount: number;
}

export interface MesData {
  mes: string;
  mesLabel: string;
  receitas: number;
  despesas: number;
}

export interface VencidoItem {
  id: string;
  descricao: string;
  valor: number;
  tipo: "entrada" | "saida";
  data_vencimento: string;
  client_name: string | null;
  client_id: string | null;
  dias_atraso: number;
}

export interface ControleProximo {
  id: string;
  tipo: string;
  tipo_label: string;
  data_evento: string;
  descricao: string;
  cliente_nome: string | null;
  processo_numero: string | null;
  cliente_id: string | null;
  processo_id: string | null;
  dias_restantes: number;
}

export interface Counts {
  totalClientes: number;
  totalProcessos: number;
  totalColaboradores: number;
  controlesProximos: number;
  vencidosCount: number;
}

export interface TopCliente {
  id: string;
  name: string;
  receita: number;
}

export interface TipoCount {
  label: string;
  count: number;
}

export interface CategoriaTotal {
  categoria: string;
  total: number;
}

export interface NovoClienteMes {
  mes: string;
  mesLabel: string;
  count: number;
}

export interface GerenciadorData {
  kpis: FinanceiroKpis;
  receitasPorMes: MesData[];
  vencidos: VencidoItem[];
  proximosControles: ControleProximo[];
  counts: Counts;
  topClientes: TopCliente[];
  processosPorTipo: TipoCount[];
  controlesPorTipo: TipoCount[];
  receitasPorCategoria: CategoriaTotal[];
  novosClientesPorMes: NovoClienteMes[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mesLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d
    .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
    .replace(". ", "/")
    .replace(".", "");
}

function buildMonthKeys(numMonths: number): string[] {
  const now = new Date();
  return Array.from({ length: numMonths }, (_, i) => {
    const d = new Date(
      now.getFullYear(),
      now.getMonth() - (numMonths - 1 - i),
      1
    );
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

function fillMonths(
  data: Array<{ mes: string; receitas: number; despesas: number }>
): MesData[] {
  const map = new Map(data.map((r) => [r.mes, r]));
  return buildMonthKeys(12).map((mes) => {
    const r = map.get(mes);
    return {
      mes,
      mesLabel: mesLabel(mes),
      receitas: r ? Number(r.receitas) : 0,
      despesas: r ? Number(r.despesas) : 0,
    };
  });
}

function fillClienteMonths(
  data: Array<{ mes: string; count: number }>
): NovoClienteMes[] {
  const map = new Map(data.map((r) => [r.mes, r]));
  return buildMonthKeys(12).map((mes) => {
    const r = map.get(mes);
    return { mes, mesLabel: mesLabel(mes), count: r ? Number(r.count) : 0 };
  });
}

function tipoLabelShort(tipo: string): string {
  const found = TIPOS_CONTROLE.find((t) => t.key === tipo);
  if (!found) return tipo;
  // Compact labels for charts
  const compact: Record<string, string> = {
    audiencias: "Audiências",
    prazos: "Prazos",
    pericias: "Perícias",
    dcb: "DCB",
    beneficios: "Benefícios",
    implantados: "Implantados",
    "implantados-data": "Impl. Data",
    alvaras: "Alvarás",
  };
  return compact[tipo] ?? found.label;
}

// ── Main Query ────────────────────────────────────────────────────────────────

export async function getGerenciadorData(): Promise<GerenciadorData> {
  const [
    kpisRows,
    mesRows,
    vencidosRows,
    proximosRows,
    countsRows,
    topClientesRows,
    processosTipoRows,
    controlesTipoRows,
    categoriasRows,
    novosClientesRows,
  ] = await Promise.all([
    // 1. KPIs financeiros
    sql`
      SELECT
        COALESCE(SUM(valor) FILTER (
          WHERE tipo = 'entrada' AND status = 'pago'
          AND date_trunc('month', COALESCE(data_pagamento, data_vencimento)) = date_trunc('month', CURRENT_DATE)
        ), 0) AS recebido_mes,
        COALESCE(SUM(valor) FILTER (
          WHERE tipo = 'saida' AND status = 'pago'
          AND date_trunc('month', COALESCE(data_pagamento, data_vencimento)) = date_trunc('month', CURRENT_DATE)
        ), 0) AS pago_mes,
        COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada' AND status = 'pendente'), 0) AS a_receber,
        COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'   AND status = 'pendente'), 0) AS a_pagar,
        COALESCE(SUM(valor) FILTER (
          WHERE tipo = 'entrada' AND status = 'pago'
          AND date_trunc('year', COALESCE(data_pagamento, data_vencimento)) = date_trunc('year', CURRENT_DATE)
        ), 0) AS recebido_ano,
        COALESCE(SUM(valor) FILTER (
          WHERE tipo = 'saida' AND status = 'pago'
          AND date_trunc('year', COALESCE(data_pagamento, data_vencimento)) = date_trunc('year', CURRENT_DATE)
        ), 0) AS pago_ano,
        COALESCE(SUM(valor) FILTER (WHERE status = 'pendente' AND data_vencimento < CURRENT_DATE), 0) AS vencidos_valor,
        COUNT(*)  FILTER (WHERE status = 'pendente' AND data_vencimento < CURRENT_DATE) AS vencidos_count
      FROM lancamentos
      WHERE status != 'cancelado'
    `,

    // 2. Receitas/despesas por mês (12 meses)
    sql`
      SELECT
        to_char(date_trunc('month', data_vencimento), 'YYYY-MM') AS mes,
        COALESCE(SUM(valor) FILTER (WHERE tipo = 'entrada'), 0) AS receitas,
        COALESCE(SUM(valor) FILTER (WHERE tipo = 'saida'),   0) AS despesas
      FROM lancamentos
      WHERE data_vencimento >= date_trunc('month', CURRENT_DATE - INTERVAL '11 months')
        AND status != 'cancelado'
      GROUP BY mes
      ORDER BY mes ASC
    `,

    // 3. Lançamentos vencidos
    sql`
      SELECT
        l.id::text,
        l.descricao,
        l.valor,
        l.tipo,
        to_char(l.data_vencimento, 'DD/MM/YYYY') AS data_vencimento,
        c.name AS client_name,
        l.client_id::text AS client_id,
        (CURRENT_DATE - l.data_vencimento)::int AS dias_atraso
      FROM lancamentos l
      LEFT JOIN clients c ON c.id = l.client_id
      WHERE l.status = 'pendente'
        AND l.data_vencimento < CURRENT_DATE
      ORDER BY l.data_vencimento ASC
      LIMIT 20
    `,

    // 4. Próximos controles (14 dias) — status IS NULL = pendente
    sql`
      SELECT
        c.id::text,
        c.tipo,
        c.data_evento::text,
        c.descricao,
        cl.name AS cliente_nome,
        cl.id::text AS cliente_id,
        p.numero  AS processo_numero,
        p.id::text AS processo_id,
        (c.data_evento - CURRENT_DATE)::int AS dias_restantes
      FROM controles c
      LEFT JOIN clients   cl ON cl.id = c.cliente_id
      LEFT JOIN processos p  ON p.id  = c.processo_id
      WHERE c.status IS NULL
        AND c.data_evento >= CURRENT_DATE
        AND c.data_evento <= CURRENT_DATE + INTERVAL '14 days'
      ORDER BY c.data_evento ASC
      LIMIT 20
    `,

    // 5. Contagens gerais
    sql`
      SELECT
        (SELECT COUNT(*)::int FROM clients)      AS total_clientes,
        (SELECT COUNT(*)::int FROM processos)    AS total_processos,
        (SELECT COUNT(*)::int FROM colaboradores) AS total_colaboradores,
        (SELECT COUNT(*)::int FROM controles
         WHERE status IS NULL
           AND data_evento >= CURRENT_DATE
           AND data_evento <= CURRENT_DATE + 7)  AS controles_proximos,
        (SELECT COUNT(*)::int FROM lancamentos
         WHERE status = 'pendente'
           AND data_vencimento < CURRENT_DATE)   AS vencidos_count
    `,

    // 6. Top 5 clientes por receita recebida
    sql`
      SELECT cl.id::text AS id, cl.name, SUM(l.valor)::numeric AS receita
      FROM lancamentos l
      JOIN clients cl ON cl.id = l.client_id
      WHERE l.tipo = 'entrada' AND l.status = 'pago'
      GROUP BY cl.id, cl.name
      ORDER BY receita DESC
      LIMIT 5
    `,

    // 7. Processos por tipo de ação
    sql`
      SELECT tipo_acao AS label, COUNT(*)::int AS count
      FROM processos
      GROUP BY tipo_acao
      ORDER BY count DESC
      LIMIT 8
    `,

    // 8. Controles pendentes por tipo
    sql`
      SELECT tipo AS label, COUNT(*)::int AS count
      FROM controles
      WHERE status IS NULL
      GROUP BY tipo
      ORDER BY count DESC
    `,

    // 9. Receitas recebidas por categoria
    sql`
      SELECT
        COALESCE(categoria, 'Sem categoria') AS categoria,
        SUM(valor)::numeric AS total
      FROM lancamentos
      WHERE tipo = 'entrada' AND status = 'pago'
      GROUP BY categoria
      ORDER BY total DESC
      LIMIT 8
    `,

    // 10. Novos clientes por mês (12 meses)
    sql`
      SELECT
        to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes,
        COUNT(*)::int AS count
      FROM clients
      WHERE created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '11 months')
      GROUP BY mes
      ORDER BY mes ASC
    `,
  ]);

  const kr = kpisRows[0];
  const kpis: FinanceiroKpis = {
    recebidoMes: Number(kr.recebido_mes),
    pagoMes: Number(kr.pago_mes),
    saldoMes: Number(kr.recebido_mes) - Number(kr.pago_mes),
    aReceber: Number(kr.a_receber),
    aPagar: Number(kr.a_pagar),
    recebidoAno: Number(kr.recebido_ano),
    pagoAno: Number(kr.pago_ano),
    vencidosValor: Number(kr.vencidos_valor),
    vencidosCount: Number(kr.vencidos_count),
  };

  const cr = countsRows[0];
  const counts: Counts = {
    totalClientes: Number(cr.total_clientes),
    totalProcessos: Number(cr.total_processos),
    totalColaboradores: Number(cr.total_colaboradores),
    controlesProximos: Number(cr.controles_proximos),
    vencidosCount: Number(cr.vencidos_count),
  };

  return {
    kpis,
    receitasPorMes: fillMonths(
      mesRows.map((r) => ({
        mes: String(r.mes),
        receitas: Number(r.receitas),
        despesas: Number(r.despesas),
      }))
    ),
    vencidos: vencidosRows.map((r) => ({
      id: String(r.id),
      descricao: String(r.descricao),
      valor: Number(r.valor),
      tipo: r.tipo as "entrada" | "saida",
      data_vencimento: String(r.data_vencimento),
      client_name: r.client_name ? String(r.client_name) : null,
      client_id: r.client_id ? String(r.client_id) : null,
      dias_atraso: Number(r.dias_atraso),
    })),
    proximosControles: proximosRows.map((r) => ({
      id: String(r.id),
      tipo: String(r.tipo),
      tipo_label: tipoLabelShort(String(r.tipo)),
      data_evento: String(r.data_evento).slice(0, 10),
      descricao: String(r.descricao),
      cliente_nome: r.cliente_nome ? String(r.cliente_nome) : null,
      processo_numero: r.processo_numero ? String(r.processo_numero) : null,
      cliente_id: r.cliente_id ? String(r.cliente_id) : null,
      processo_id: r.processo_id ? String(r.processo_id) : null,
      dias_restantes: Number(r.dias_restantes),
    })),
    counts,
    topClientes: topClientesRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      receita: Number(r.receita),
    })),
    processosPorTipo: processosTipoRows.map((r) => ({
      label: String(r.label),
      count: Number(r.count),
    })),
    controlesPorTipo: controlesTipoRows.map((r) => ({
      label: tipoLabelShort(String(r.label)),
      count: Number(r.count),
    })),
    receitasPorCategoria: categoriasRows.map((r) => ({
      categoria: String(r.categoria),
      total: Number(r.total),
    })),
    novosClientesPorMes: fillClienteMonths(
      novosClientesRows.map((r) => ({
        mes: String(r.mes),
        count: Number(r.count),
      }))
    ),
  };
}
