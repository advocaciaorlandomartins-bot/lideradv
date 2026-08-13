import sql from "./db";
import { mapRow as mapLancamentoRow, type Lancamento } from "./lancamentos-db";
import {
  getEstagioSnapshotByResponsavel,
  type EstagioSnapshot,
} from "./producao-db";

export interface LancamentoPessoal {
  id: string;
  tipo: "receita" | "despesa";
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  status: "recebido" | "a_receber" | "pago" | "pendente";
  recorrente: boolean;
  periodicidade: string | null;
  created_at: string;
}

export interface ProcessoHonorario {
  id: string;
  tipo_acao: string;
  client_name: string;
  status: string;
  modelo_honorario: string | null;
  valor_honorario: number | null;
  percentual_honorario: number | null;
  valor_causa: number | null;
  honorario_estimado: number;
}

export interface EscritorioMes {
  recebidoMes: number;
  aReceberMes: number;
  totalAReceber: number;
}

export interface FluxoMensalItem {
  mesISO: string;
  mes: string;
  entradas: number;
}

export interface MeuFinanceiroInitial {
  lancamentos: LancamentoPessoal[];
  honorariosEscritorio: number;
  processosHonorarios: ProcessoHonorario[];
  escritorioMes: EscritorioMes;
  fluxoEscritorio: FluxoMensalItem[];
  /** Lançamentos reais (tabela lancamentos) do escritório aguardando resultado do processo — sem data definida. */
  aguardandoResultado: Lancamento[];
  aguardandoResultadoTotal: number;
  /** Lançamentos reais pendentes com vencimento definido, por mês — alimenta a projeção junto com a remuneração. */
  fluxoHonorarios: FluxoMensalItem[];
  processosAtivosCount: number;
  estagioSnapshot: EstagioSnapshot;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLancamento(r: any): LancamentoPessoal {
  return {
    id: String(r.id),
    tipo: r.tipo as "receita" | "despesa",
    categoria: String(r.categoria),
    descricao: String(r.descricao),
    valor: Number(r.valor),
    data: String(r.data).slice(0, 10),
    status: r.status as "recebido" | "a_receber" | "pago" | "pendente",
    recorrente: Boolean(r.recorrente),
    periodicidade: r.periodicidade ? String(r.periodicidade) : null,
    created_at: String(r.created_at),
  };
}

const MESES_CURTO_DB = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

export async function getMeuFinanceiroInitial(
  userId: string
): Promise<MeuFinanceiroInitial> {
  const agora = new Date();
  const anoMes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;

  // Busca colaborador_id do usuário — pode ser NULL para administradores sem vínculo
  const [userRow] = await sql`
    SELECT colaborador_id::text FROM usuarios WHERE id = ${userId}::uuid
  `;
  const colaboradorId = userRow?.colaborador_id ?? null;

  const [
    lancamentosRows,
    processosRows,
    remuneracaoKpiRows,
    fluxoRows,
    aguardandoResultadoRows,
    fluxoHonorariosRows,
    processosAtivosRows,
    estagioSnapshot,
  ] = await Promise.all([
    // Lançamentos pessoais do usuário
    sql`
        SELECT id::text, tipo, categoria, descricao, valor,
               data::text, status, recorrente, periodicidade, created_at::text
        FROM meu_financeiro_lancamentos
        WHERE usuario_id = ${userId}::uuid
        ORDER BY data DESC, created_at DESC
      `,
    // Processos com honorários:
    // • se tem colaborador_id: apenas processos onde é responsável
    // • se não tem (admin solo): todos os processos ativos com honorário
    colaboradorId
      ? sql`
            SELECT
              p.id::text,
              p.tipo_acao,
              c.name AS client_name,
              p.status,
              p.modelo_honorario,
              p.valor_honorario,
              p.percentual_honorario,
              p.valor_causa
            FROM processos p
            LEFT JOIN clients c ON c.id = p.client_id
            WHERE p.responsavel_id = ${colaboradorId}::uuid
              AND p.status IN ('ativo', 'em_andamento')
              AND p.deleted_at IS NULL
              AND (
                p.valor_honorario IS NOT NULL
                OR (p.percentual_honorario IS NOT NULL AND p.valor_causa IS NOT NULL)
              )
            ORDER BY
              COALESCE(p.valor_honorario, p.valor_causa * p.percentual_honorario / 100) DESC NULLS LAST
            LIMIT 50
          `
      : sql`
            SELECT
              p.id::text,
              p.tipo_acao,
              c.name AS client_name,
              p.status,
              p.modelo_honorario,
              p.valor_honorario,
              p.percentual_honorario,
              p.valor_causa
            FROM processos p
            LEFT JOIN clients c ON c.id = p.client_id
            WHERE p.status IN ('ativo', 'em_andamento')
              AND p.deleted_at IS NULL
              AND (
                p.valor_honorario IS NOT NULL
                OR (p.percentual_honorario IS NOT NULL AND p.valor_causa IS NOT NULL)
              )
            ORDER BY
              COALESCE(p.valor_honorario, p.valor_causa * p.percentual_honorario / 100) DESC NULLS LAST
            LIMIT 50
          `,
    // Remunerações: apenas se tiver colaborador_id vinculado
    colaboradorId
      ? sql`
            SELECT
              COALESCE(SUM(r.valor) FILTER (
                WHERE r.status = 'pago'
                  AND to_char(r.data_pagamento, 'YYYY-MM') = ${anoMes}
              ), 0) AS recebido_mes,
              COALESCE(SUM(r.valor) FILTER (
                WHERE r.status = 'pendente'
                  AND to_char(r.competencia, 'YYYY-MM') = ${anoMes}
              ), 0) AS a_receber_mes,
              COALESCE(SUM(r.valor) FILTER (
                WHERE r.status = 'pendente'
              ), 0) AS total_pendente
            FROM remuneracoes r
            WHERE r.colaborador_id = ${colaboradorId}::uuid
          `
      : sql`SELECT 0 AS recebido_mes, 0 AS a_receber_mes, 0 AS total_pendente`,
    // Previsão de remunerações — apenas se tiver colaborador_id
    colaboradorId
      ? sql`
            SELECT
              to_char(date_trunc('month', r.competencia), 'YYYY-MM') AS mes_iso,
              COALESCE(SUM(r.valor), 0) AS entradas
            FROM remuneracoes r
            WHERE r.colaborador_id = ${colaboradorId}::uuid
              AND r.status = 'pendente'
              AND r.competencia >= date_trunc('month', CURRENT_DATE)
              AND r.competencia <  date_trunc('month', CURRENT_DATE) + INTERVAL '12 months'
            GROUP BY 1
            ORDER BY 1
          `
      : sql`SELECT NULL AS mes_iso, 0 AS entradas WHERE false`,
    // Lançamentos reais aguardando resultado do processo (sem data definida)
    colaboradorId
      ? sql`
            SELECT
              l.id::text, l.tipo, l.categoria, l.descricao, l.valor,
              l.client_id::text, c.name AS client_name,
              l.processo_id::text, p.tipo_acao AS processo_tipo,
              l.remuneracao_id::text, l.status,
              to_char(l.data_vencimento, 'DD/MM/YYYY') AS data_vencimento,
              to_char(l.data_pagamento,  'DD/MM/YYYY') AS data_pagamento,
              l.parcela_atual, l.total_parcelas, l.grupo_parcelas::text,
              l.observacoes, l.created_at
            FROM lancamentos l
            INNER JOIN processos p ON p.id = l.processo_id
            LEFT JOIN clients c ON c.id = l.client_id
            WHERE p.responsavel_id = ${colaboradorId}::uuid
              AND l.status = 'aguardando_resultado'
            ORDER BY l.valor DESC
          `
      : sql`
            SELECT
              l.id::text, l.tipo, l.categoria, l.descricao, l.valor,
              l.client_id::text, c.name AS client_name,
              l.processo_id::text, p.tipo_acao AS processo_tipo,
              l.remuneracao_id::text, l.status,
              to_char(l.data_vencimento, 'DD/MM/YYYY') AS data_vencimento,
              to_char(l.data_pagamento,  'DD/MM/YYYY') AS data_pagamento,
              l.parcela_atual, l.total_parcelas, l.grupo_parcelas::text,
              l.observacoes, l.created_at
            FROM lancamentos l
            LEFT JOIN processos p ON p.id = l.processo_id
            LEFT JOIN clients c ON c.id = l.client_id
            WHERE l.status = 'aguardando_resultado'
            ORDER BY l.valor DESC
          `,
    // Lançamentos reais pendentes com vencimento definido, por mês (12 meses)
    colaboradorId
      ? sql`
            SELECT
              to_char(date_trunc('month', l.data_vencimento), 'YYYY-MM') AS mes_iso,
              COALESCE(SUM(l.valor), 0) AS entradas
            FROM lancamentos l
            INNER JOIN processos p ON p.id = l.processo_id
            WHERE p.responsavel_id = ${colaboradorId}::uuid
              AND l.status = 'pendente'
              AND l.tipo = 'entrada'
              AND l.data_vencimento >= date_trunc('month', CURRENT_DATE)
              AND l.data_vencimento <  date_trunc('month', CURRENT_DATE) + INTERVAL '12 months'
            GROUP BY 1
            ORDER BY 1
          `
      : sql`
            SELECT
              to_char(date_trunc('month', l.data_vencimento), 'YYYY-MM') AS mes_iso,
              COALESCE(SUM(l.valor), 0) AS entradas
            FROM lancamentos l
            WHERE l.status = 'pendente'
              AND l.tipo = 'entrada'
              AND l.data_vencimento >= date_trunc('month', CURRENT_DATE)
              AND l.data_vencimento <  date_trunc('month', CURRENT_DATE) + INTERVAL '12 months'
            GROUP BY 1
            ORDER BY 1
          `,
    // Contagem de processos ativos como responsável (status ativo/em_andamento)
    colaboradorId
      ? sql`
            SELECT COUNT(*)::int AS total
            FROM processos
            WHERE responsavel_id = ${colaboradorId}::uuid
              AND status IN ('ativo', 'em_andamento')
              AND deleted_at IS NULL
          `
      : sql`
            SELECT COUNT(*)::int AS total
            FROM processos
            WHERE status IN ('ativo', 'em_andamento')
              AND deleted_at IS NULL
          `,
    // Snapshot de processos por estágio (administrativo/judicial/produção/análise)
    getEstagioSnapshotByResponsavel(colaboradorId),
  ]);

  // Processos com honorário estimado (apenas do responsável)
  const processosHonorarios: ProcessoHonorario[] = processosRows.map((r) => {
    const fixo = r.valor_honorario != null ? Number(r.valor_honorario) : null;
    const perc =
      r.percentual_honorario != null && r.valor_causa != null
        ? (Number(r.percentual_honorario) / 100) * Number(r.valor_causa)
        : null;
    return {
      id: r.id,
      tipo_acao: r.tipo_acao ?? "–",
      client_name: r.client_name ?? "–",
      status: r.status,
      modelo_honorario: r.modelo_honorario ?? null,
      valor_honorario:
        r.valor_honorario != null ? Number(r.valor_honorario) : null,
      percentual_honorario:
        r.percentual_honorario != null ? Number(r.percentual_honorario) : null,
      valor_causa: r.valor_causa != null ? Number(r.valor_causa) : null,
      honorario_estimado: fixo ?? perc ?? 0,
    };
  });

  const honorariosEscritorio = processosHonorarios.reduce(
    (s, p) => s + p.honorario_estimado,
    0
  );

  const kr = remuneracaoKpiRows[0];
  const escritorioMes: EscritorioMes = {
    recebidoMes: Number(kr?.recebido_mes ?? 0),
    aReceberMes: Number(kr?.a_receber_mes ?? 0),
    totalAReceber: Number(kr?.total_pendente ?? 0),
  };

  function buildFluxo(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows: readonly Record<string, any>[]
  ): FluxoMensalItem[] {
    // Preenche todos os 12 meses mesmo sem lançamentos/remunerações agendadas
    const map = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(agora.getFullYear(), agora.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map.set(key, 0);
    }
    for (const r of rows) {
      const iso = String(r.mes_iso);
      if (map.has(iso)) map.set(iso, Number(r.entradas));
    }
    return Array.from(map.entries()).map(([iso, entradas]) => {
      const [y, m] = iso.split("-");
      return {
        mesISO: iso,
        mes: `${MESES_CURTO_DB[Number(m) - 1]}/${y.slice(2)}`,
        entradas,
      };
    });
  }

  const fluxoEscritorio = buildFluxo(fluxoRows);
  const fluxoHonorarios = buildFluxo(fluxoHonorariosRows);

  const aguardandoResultado: Lancamento[] =
    aguardandoResultadoRows.map(mapLancamentoRow);
  const aguardandoResultadoTotal = aguardandoResultado.reduce(
    (s, l) => s + l.valor,
    0
  );
  const processosAtivosCount = Number(processosAtivosRows[0]?.total ?? 0);

  return {
    lancamentos: lancamentosRows.map(mapLancamento),
    honorariosEscritorio,
    processosHonorarios,
    escritorioMes,
    fluxoEscritorio,
    aguardandoResultado,
    aguardandoResultadoTotal,
    fluxoHonorarios,
    processosAtivosCount,
    estagioSnapshot,
  };
}

export async function criarLancamentoPessoal(
  userId: string,
  data: Omit<LancamentoPessoal, "id" | "created_at">
): Promise<LancamentoPessoal> {
  const rows = await sql`
    INSERT INTO meu_financeiro_lancamentos
      (usuario_id, tipo, categoria, descricao, valor, data, status, recorrente, periodicidade)
    VALUES
      (${userId}::uuid, ${data.tipo}, ${data.categoria}, ${data.descricao},
       ${data.valor}, ${data.data}::date, ${data.status}, ${data.recorrente},
       ${data.periodicidade ?? null})
    RETURNING id::text, tipo, categoria, descricao, valor,
              data::text, status, recorrente, periodicidade, created_at::text
  `;
  return mapLancamento(rows[0]);
}

export async function atualizarLancamentoPessoal(
  id: string,
  userId: string,
  data: Omit<LancamentoPessoal, "id" | "created_at">
): Promise<LancamentoPessoal | null> {
  const rows = await sql`
    UPDATE meu_financeiro_lancamentos SET
      tipo          = ${data.tipo},
      categoria     = ${data.categoria},
      descricao     = ${data.descricao},
      valor         = ${data.valor},
      data          = ${data.data}::date,
      status        = ${data.status},
      recorrente    = ${data.recorrente},
      periodicidade = ${data.periodicidade ?? null},
      updated_at    = NOW()
    WHERE id = ${id}::uuid AND usuario_id = ${userId}::uuid
    RETURNING id::text, tipo, categoria, descricao, valor,
              data::text, status, recorrente, periodicidade, created_at::text
  `;
  return rows.length > 0 ? mapLancamento(rows[0]) : null;
}

export async function deletarLancamentoPessoal(
  id: string,
  userId: string
): Promise<boolean> {
  const rows = await sql`
    DELETE FROM meu_financeiro_lancamentos
    WHERE id = ${id}::uuid AND usuario_id = ${userId}::uuid
    RETURNING id
  `;
  return rows.length > 0;
}
