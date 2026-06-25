import { unstable_cache } from "next/cache";
import sql from "./db";
import {
  listarCompromissosProximos,
  type Compromisso,
} from "./compromissos-db";

export type { Compromisso };

export interface ClienteDevedor {
  client_id: string;
  client_name: string;
  total_vencido: number;
  count_vencidos: number;
  max_dias_atraso: number;
}

export interface LancamentoVencidoDetalhe {
  id: string;
  client_id: string | null;
  client_name: string | null;
  descricao: string;
  valor: number;
  data_vencimento: string;
  dias_atraso: number;
}

export interface ControleDetalhe {
  id: string;
  tipo: string;
  tipo_label: string;
  data_evento: string;
  descricao: string;
  cliente_nome: string | null;
  cliente_id: string | null;
  processo_numero: string | null;
  processo_id: string | null;
  dias_restantes: number;
  href?: string;
}

export interface AniversarianteHoje {
  id: string;
  name: string;
  phone: string | null;
  birth_date: string;
}

const TIPO_LABELS: Record<string, string> = {
  audiencias: "Audiência",
  prazos: "Prazo",
  pericias: "Perícia",
  dcb: "DCB",
  beneficios: "Benefício",
  implantados: "Implantado",
  "implantados-data": "Impl. Data",
  alvaras: "Alvará",
};

async function _getDashboardData(login?: string) {
  const [
    clientesDevedoresRows,
    lancamentosVencidosRows,
    proximosControlesRows,
    aniversariantesRows,
  ] = await Promise.all([
    // Clientes com lançamentos de entrada vencidos (agrupados)
    sql`
        SELECT
          c.id::text           AS client_id,
          c.name               AS client_name,
          SUM(l.valor)::numeric AS total_vencido,
          COUNT(*)::int         AS count_vencidos,
          MAX((CURRENT_DATE - l.data_vencimento)::int) AS max_dias_atraso
        FROM lancamentos l
        JOIN clients c ON c.id = l.client_id
        WHERE l.status = 'pendente'
          AND l.tipo   = 'entrada'
          AND l.data_vencimento < CURRENT_DATE
        GROUP BY c.id, c.name
        ORDER BY total_vencido DESC
        LIMIT 8
      `,

    // Todos os lançamentos vencidos (qualquer tipo), com client_id
    sql`
        SELECT
          l.id::text                                       AS id,
          l.client_id::text                                AS client_id,
          c.name                                           AS client_name,
          l.descricao,
          l.valor,
          l.tipo,
          to_char(l.data_vencimento, 'DD/MM/YYYY')        AS data_vencimento,
          (CURRENT_DATE - l.data_vencimento)::int          AS dias_atraso
        FROM lancamentos l
        LEFT JOIN clients c ON c.id = l.client_id
        WHERE l.status = 'pendente'
          AND l.data_vencimento < CURRENT_DATE
        ORDER BY l.data_vencimento ASC
        LIMIT 20
      `,

    // Próximos controles + eventos de processos (UNION) para o mini-calendário
    sql`
        SELECT
          'ctrl-' || c.id::text                             AS id,
          c.tipo,
          c.data_evento::text                               AS data_evento,
          c.descricao,
          cl.id::text                                       AS cliente_id,
          cl.name                                           AS cliente_nome,
          p.id::text                                        AS processo_id,
          p.numero                                          AS processo_numero,
          (c.data_evento - CURRENT_DATE)::int               AS dias_restantes
        FROM controles c
        LEFT JOIN clients   cl ON cl.id = c.cliente_id
        LEFT JOIN processos p  ON p.id  = c.processo_id
        WHERE c.status IS NULL
          AND c.data_evento >= CURRENT_DATE
          AND c.data_evento <= CURRENT_DATE + INTERVAL '14 days'
          AND (cl.deleted_at IS NULL OR cl.id IS NULL)
          AND (p.deleted_at IS NULL OR p.id IS NULL)

        UNION ALL

        SELECT
          'ev-' || ec.id::text                              AS id,
          COALESCE(ec.tipo, 'prazos')                       AS tipo,
          ec.data::text                                     AS data_evento,
          ec.titulo                                         AS descricao,
          cl.id::text                                       AS cliente_id,
          cl.name                                           AS cliente_nome,
          p.id::text                                        AS processo_id,
          p.numero                                          AS processo_numero,
          (ec.data - CURRENT_DATE)::int                     AS dias_restantes
        FROM eventos_controles ec
        JOIN processos p   ON p.id  = ec.processo_id AND p.deleted_at IS NULL
        LEFT JOIN clients cl ON cl.id = p.client_id AND cl.deleted_at IS NULL
        WHERE ec.data >= CURRENT_DATE
          AND ec.data <= CURRENT_DATE + INTERVAL '14 days'

        ORDER BY data_evento ASC
        LIMIT 20
      `,

    // Todos os clientes PF com data de aniversário (para filtro por mês no dashboard)
    sql`
        SELECT
          id::text,
          name,
          phone,
          TO_CHAR(birth_date, 'YYYY-MM-DD') AS birth_date
        FROM clients
        WHERE type = 'PF'
          AND birth_date IS NOT NULL
          AND deleted_at IS NULL
        ORDER BY
          EXTRACT(MONTH FROM birth_date),
          EXTRACT(DAY FROM birth_date),
          name
      `,
  ]);

  const clientesDevedores: ClienteDevedor[] = clientesDevedoresRows.map(
    (r) => ({
      client_id: String(r.client_id),
      client_name: String(r.client_name),
      total_vencido: Number(r.total_vencido),
      count_vencidos: Number(r.count_vencidos),
      max_dias_atraso: Number(r.max_dias_atraso),
    })
  );

  const lancamentosVencidos: LancamentoVencidoDetalhe[] =
    lancamentosVencidosRows.map((r) => ({
      id: String(r.id),
      client_id: r.client_id ? String(r.client_id) : null,
      client_name: r.client_name ? String(r.client_name) : null,
      descricao: String(r.descricao),
      valor: Number(r.valor),
      data_vencimento: String(r.data_vencimento),
      dias_atraso: Number(r.dias_atraso),
    }));

  const proximosControles: ControleDetalhe[] = proximosControlesRows.map(
    (r) => {
      const id = String(r.id);
      const isEvento = id.startsWith("ev-");
      const processoId = r.processo_id ? String(r.processo_id) : null;
      return {
        id,
        tipo: String(r.tipo),
        tipo_label: TIPO_LABELS[String(r.tipo)] ?? String(r.tipo),
        data_evento: String(r.data_evento).slice(0, 10),
        descricao: String(r.descricao),
        cliente_id: r.cliente_id ? String(r.cliente_id) : null,
        cliente_nome: r.cliente_nome ? String(r.cliente_nome) : null,
        processo_id: processoId,
        processo_numero: r.processo_numero ? String(r.processo_numero) : null,
        dias_restantes: Number(r.dias_restantes),
        href: isEvento
          ? processoId
            ? `/dashboard/processos/${processoId}`
            : "/dashboard/processos"
          : `/dashboard/controles/${id.replace("ctrl-", "")}`,
      };
    }
  );

  const aniversariantesTodos: AniversarianteHoje[] = aniversariantesRows.map(
    (r) => ({
      id: String(r.id),
      name: String(r.name),
      phone: r.phone ? String(r.phone) : null,
      birth_date: String(r.birth_date),
    })
  );

  const compromissosProximos: Compromisso[] = login
    ? await listarCompromissosProximos(login, 14)
    : [];

  return {
    clientesDevedores,
    lancamentosVencidos,
    proximosControles,
    aniversariantesTodos,
    compromissosProximos,
  };
}

export const getDashboardData = unstable_cache(
  _getDashboardData,
  ["dashboard-data"],
  { revalidate: 30 }
);

export interface AlertaPrevidenciario {
  id: string;
  tipo: "dcb_proxima" | "indeferimento";
  processo_id: string;
  client_id: string;
  client_name: string;
  tipo_acao: string;
  data_ref: string;
  dias: number;
}

async function _getAlertasPrevidenciarios(): Promise<AlertaPrevidenciario[]> {
  const rows = await sql`
    SELECT
      p.id::text           AS processo_id,
      p.client_id::text    AS client_id,
      c.name               AS client_name,
      p.tipo_acao,
      'dcb_proxima'        AS tipo,
      to_char(p.dcb, 'DD/MM/YYYY') AS data_ref,
      (p.dcb - CURRENT_DATE)::int  AS dias
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    WHERE p.dcb IS NOT NULL
      AND p.dcb BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE + INTERVAL '60 days'
      AND p.status = 'ativo'
      AND p.deleted_at IS NULL

    UNION ALL

    SELECT
      p.id::text           AS processo_id,
      p.client_id::text    AS client_id,
      c.name               AS client_name,
      p.tipo_acao,
      'indeferimento'      AS tipo,
      to_char(COALESCE(p.data_resultado_admin, p.updated_at::date), 'DD/MM/YYYY') AS data_ref,
      0                    AS dias
    FROM processos p
    JOIN clients c ON c.id = p.client_id
    WHERE p.resultado_admin = 'indeferido'
      AND p.status = 'ativo'
      AND p.deleted_at IS NULL
      AND (p.fase IS NULL OR p.fase NOT IN ('Conhecimento','Instrução','Julgamento','Recurso','Execução','Cumprimento de Sentença'))

    ORDER BY dias ASC
    LIMIT 15
  `;

  return rows.map((r) => ({
    id: `${r.tipo}-${r.processo_id}`,
    tipo: r.tipo as "dcb_proxima" | "indeferimento",
    processo_id: String(r.processo_id),
    client_id: String(r.client_id),
    client_name: String(r.client_name),
    tipo_acao: String(r.tipo_acao),
    data_ref: String(r.data_ref),
    dias: Number(r.dias),
  }));
}

export const getAlertasPrevidenciarios = unstable_cache(
  _getAlertasPrevidenciarios,
  ["alertas-previdenciarios"],
  { revalidate: 60 }
);
