import { unstable_cache } from "next/cache";
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

export interface CrmTarefaProxima {
  id: string;
  titulo: string;
  lead_id: string;
  lead_nome: string;
  data_vencimento: string;
  dias_restantes: number;
  responsavel_nome: string | null;
}

export interface CrmStats {
  leadsTotal: number;
  leadsAtivos: number;
  leadsMes: number;
  leadsFechados: number;
  taxaConversao: number;
  tarefasVencidas: number;
  tarefasProximas7d: number;
  leadsPorEstagio: Array<{ estagio: string; label: string; count: number }>;
  tarefasProximas: CrmTarefaProxima[];
  leadsPorArea: Array<{ area: string; count: number }>;
}

export interface ProducaoCasoUrgente {
  id: string;
  client_name: string;
  tipo_acao: string;
  estagio_producao: string;
  dias_no_estagio: number;
}

export interface ProducaoStats {
  porEstagio: Array<{ estagio: string; count: number; max_dias: number }>;
  casosUrgentes: ProducaoCasoUrgente[];
  totalAtivos: number;
}

export interface EquipeTarefa {
  id: string;
  titulo: string;
  prioridade: string;
  status: string;
  prazo: string | null;
  processo_numero: string | null;
  client_name: string | null;
  processo_id: string | null;
  client_id: string | null;
}

export interface EquipeControle {
  id: string;
  descricao: string;
  tipo: string;
  data_evento: string | null;
  client_name: string | null;
  processo_id: string | null;
  client_id: string | null;
}

export interface EquipeMembro {
  id: string;
  login: string;
  nome: string;
  categoria: string;
  tarefas: EquipeTarefa[];
  controles: EquipeControle[];
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
  crm: CrmStats;
  producao: ProducaoStats;
  equipe: EquipeMembro[];
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

async function _getGerenciadorData(): Promise<GerenciadorData> {
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
    crmCountsRows,
    crmEstagioRows,
    crmTarefasRows,
    crmAreaRows,
    producaoEstagioRows,
    producaoUrgentesRows,
    equipeUsuariosRows,
    equipeTarefasRows,
    equipeControlesRows,
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
        AND (cl.deleted_at IS NULL OR cl.id IS NULL)
        AND (p.deleted_at IS NULL OR p.id IS NULL)
      ORDER BY c.data_evento ASC
      LIMIT 20
    `,

    // 5. Contagens gerais
    sql`
      SELECT
        (SELECT COUNT(*)::int FROM clients WHERE deleted_at IS NULL)      AS total_clientes,
        (SELECT COUNT(*)::int FROM processos WHERE deleted_at IS NULL)    AS total_processos,
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
      WHERE deleted_at IS NULL
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
      WHERE deleted_at IS NULL
        AND created_at >= date_trunc('month', CURRENT_DATE - INTERVAL '11 months')
      GROUP BY mes
      ORDER BY mes ASC
    `,

    // 11. CRM — contagens gerais
    sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE estagio NOT IN ('fechado','perdido'))::int AS ativos,
        COUNT(*) FILTER (WHERE estagio = 'fechado')::int AS fechados,
        COUNT(*) FILTER (WHERE estagio = 'perdido')::int AS perdidos,
        COUNT(*) FILTER (
          WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)
        )::int AS leads_mes,
        (SELECT COUNT(*)::int FROM crm_tarefas
         WHERE concluida = FALSE AND data_vencimento < CURRENT_DATE) AS tarefas_vencidas,
        (SELECT COUNT(*)::int FROM crm_tarefas
         WHERE concluida = FALSE
           AND data_vencimento >= CURRENT_DATE
           AND data_vencimento <= CURRENT_DATE + 7) AS tarefas_proximas_7d
      FROM crm_leads
    `,

    // 12. CRM — leads por estágio
    sql`
      SELECT estagio, COUNT(*)::int AS count
      FROM crm_leads
      GROUP BY estagio
      ORDER BY count DESC
    `,

    // 13. CRM — tarefas próximas + vencidas (próximos 7 dias + atrasadas)
    sql`
      SELECT
        t.id::text,
        t.titulo,
        t.lead_id::text,
        l.nome AS lead_nome,
        to_char(t.data_vencimento, 'DD/MM/YYYY') AS data_vencimento,
        (t.data_vencimento - CURRENT_DATE)::int AS dias_restantes,
        col.nome AS responsavel_nome
      FROM crm_tarefas t
      JOIN crm_leads l ON l.id = t.lead_id
      LEFT JOIN colaboradores col ON col.id = t.responsavel_id
      WHERE t.concluida = FALSE
        AND t.data_vencimento IS NOT NULL
        AND t.data_vencimento <= CURRENT_DATE + 7
      ORDER BY t.data_vencimento ASC
      LIMIT 15
    `,

    // 14. CRM — leads por área de interesse
    sql`
      SELECT
        COALESCE(area_interesse, 'Sem área') AS area,
        COUNT(*)::int AS count
      FROM crm_leads
      WHERE estagio NOT IN ('perdido')
      GROUP BY area
      ORDER BY count DESC
      LIMIT 8
    `,

    // 15. Produção — contagens por estágio
    sql`
      SELECT
        estagio_producao,
        COUNT(*)::int AS count,
        COALESCE(MAX(
          EXTRACT(EPOCH FROM (NOW() - data_estagio_at)) / 86400
        )::int, 0) AS max_dias
      FROM processos
      WHERE deleted_at IS NULL
      GROUP BY estagio_producao
      ORDER BY CASE estagio_producao
        WHEN 'analise'        THEN 1
        WHEN 'producao'       THEN 2
        WHEN 'administrativo' THEN 3
        WHEN 'judicial'       THEN 4
        WHEN 'arquivado'      THEN 5
        ELSE 6
      END
    `,

    // 16. Produção — casos com mais tempo parados (não arquivados)
    sql`
      SELECT
        p.id::text,
        c.name AS client_name,
        p.tipo_acao,
        p.estagio_producao,
        EXTRACT(EPOCH FROM (NOW() - p.data_estagio_at))::int / 86400 AS dias_no_estagio
      FROM processos p
      JOIN clients c ON c.id = p.client_id
      WHERE p.estagio_producao != 'arquivado'
        AND p.deleted_at IS NULL
      ORDER BY p.data_estagio_at ASC
      LIMIT 8
    `,

    // 17. Equipe — usuários ativos
    sql`
      SELECT id::text, login, nome, categoria
      FROM usuarios
      WHERE ativo = TRUE
      ORDER BY nome ASC
    `,

    // 18. Equipe — tarefas pendentes por responsável
    sql`
      SELECT
        t.id::text, t.titulo, t.responsavel, t.prioridade, t.prazo::text, t.status,
        t.processo_id::text, t.client_id::text,
        p.numero AS processo_numero,
        c.name AS client_name
      FROM tarefas_processo t
      LEFT JOIN processos p ON p.id = t.processo_id
      LEFT JOIN clients c ON c.id = t.client_id
      WHERE t.status IN ('Pendente', 'Em andamento') AND t.responsavel IS NOT NULL
      ORDER BY t.responsavel, t.prazo ASC NULLS LAST
    `,

    // 19. Equipe — controles pendentes por responsável
    sql`
      SELECT
        ec.id::text, ec.descricao, ec.tipo, ec.data_evento::text,
        ec.responsavel_id::text,
        u.login AS responsavel_login,
        cl.name AS client_name,
        ec.processo_id::text, ec.cliente_id::text AS client_id
      FROM controles ec
      JOIN usuarios u ON u.id = ec.responsavel_id
      LEFT JOIN clients cl ON cl.id = ec.cliente_id
      WHERE ec.status IS NULL OR ec.status = 'em_andamento'
      ORDER BY u.login, ec.data_evento ASC NULLS LAST
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

  const ESTAGIO_LABELS: Record<string, string> = {
    novo_contato: "Novo Contato",
    consulta_agendada: "Consulta Agendada",
    em_analise: "Em Análise",
    proposta_enviada: "Proposta Enviada",
    fechado: "Fechado",
    perdido: "Perdido",
  };

  const cc = crmCountsRows[0] ?? {};
  const crmFechados = Number(cc.fechados ?? 0);
  const crmPerdidos = Number(cc.perdidos ?? 0);
  const crmConvertidos = crmFechados + crmPerdidos;
  const crm: CrmStats = {
    leadsTotal: Number(cc.total ?? 0),
    leadsAtivos: Number(cc.ativos ?? 0),
    leadsMes: Number(cc.leads_mes ?? 0),
    leadsFechados: crmFechados,
    taxaConversao:
      crmConvertidos > 0 ? (crmFechados / crmConvertidos) * 100 : 0,
    tarefasVencidas: Number(cc.tarefas_vencidas ?? 0),
    tarefasProximas7d: Number(cc.tarefas_proximas_7d ?? 0),
    leadsPorEstagio: crmEstagioRows.map((r) => ({
      estagio: String(r.estagio),
      label: ESTAGIO_LABELS[String(r.estagio)] ?? String(r.estagio),
      count: Number(r.count),
    })),
    tarefasProximas: crmTarefasRows.map((r) => ({
      id: String(r.id),
      titulo: String(r.titulo),
      lead_id: String(r.lead_id),
      lead_nome: String(r.lead_nome),
      data_vencimento: String(r.data_vencimento),
      dias_restantes: Number(r.dias_restantes),
      responsavel_nome: r.responsavel_nome ? String(r.responsavel_nome) : null,
    })),
    leadsPorArea: crmAreaRows.map((r) => ({
      area: String(r.area),
      count: Number(r.count),
    })),
  };

  const producaoPorEstagio = producaoEstagioRows.map((r) => ({
    estagio: String(r.estagio_producao),
    count: Number(r.count),
    max_dias: Number(r.max_dias),
  }));

  const producao: ProducaoStats = {
    porEstagio: producaoPorEstagio,
    totalAtivos: producaoPorEstagio
      .filter((e) => e.estagio !== "arquivado")
      .reduce((s, e) => s + e.count, 0),
    casosUrgentes: producaoUrgentesRows.map((r) => ({
      id: String(r.id),
      client_name: String(r.client_name),
      tipo_acao: String(r.tipo_acao),
      estagio_producao: String(r.estagio_producao),
      dias_no_estagio: Number(r.dias_no_estagio),
    })),
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
    crm,
    producao,
    equipe: equipeUsuariosRows.map((u) => {
      const login = String(u.login);
      const uid = String(u.id);
      return {
        id: uid,
        login,
        nome: String(u.nome),
        categoria: String(u.categoria),
        tarefas: equipeTarefasRows
          .filter((t) => String(t.responsavel) === login)
          .map((t) => ({
            id: String(t.id),
            titulo: String(t.titulo),
            prioridade: String(t.prioridade),
            status: String(t.status),
            prazo: t.prazo ? String(t.prazo).slice(0, 10) : null,
            processo_numero: t.processo_numero
              ? String(t.processo_numero)
              : null,
            client_name: t.client_name ? String(t.client_name) : null,
            processo_id: t.processo_id ? String(t.processo_id) : null,
            client_id: t.client_id ? String(t.client_id) : null,
          })),
        controles: equipeControlesRows
          .filter((c) => String(c.responsavel_id) === uid)
          .map((c) => ({
            id: String(c.id),
            descricao: String(c.descricao),
            tipo: String(c.tipo),
            data_evento: c.data_evento
              ? String(c.data_evento).slice(0, 10)
              : null,
            client_name: c.client_name ? String(c.client_name) : null,
            processo_id: c.processo_id ? String(c.processo_id) : null,
            client_id: c.client_id ? String(c.client_id) : null,
          })),
      };
    }),
  };
}

export const getGerenciadorData = unstable_cache(
  _getGerenciadorData,
  ["gerenciador-data"],
  { revalidate: 30 }
);
