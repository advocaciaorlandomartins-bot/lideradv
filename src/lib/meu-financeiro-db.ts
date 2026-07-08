import sql from "./db";

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

  const [lancamentosRows, processosRows, remuneracaoKpiRows, fluxoRows] =
    await Promise.all([
      // Lançamentos pessoais do usuário
      sql`
        SELECT id::text, tipo, categoria, descricao, valor,
               data::text, status, recorrente, periodicidade, created_at::text
        FROM meu_financeiro_lancamentos
        WHERE usuario_id = ${userId}::uuid
        ORDER BY data DESC, created_at DESC
      `,
      // Processos onde este usuário é responsável e têm honorários definidos
      sql`
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
        JOIN usuarios u ON u.colaborador_id = p.responsavel_id
        WHERE u.id = ${userId}::uuid
          AND p.status IN ('ativo', 'em_andamento')
          AND (
            p.valor_honorario IS NOT NULL
            OR (p.percentual_honorario IS NOT NULL AND p.valor_causa IS NOT NULL)
          )
        ORDER BY
          COALESCE(p.valor_honorario, p.valor_causa * p.percentual_honorario / 100) DESC NULLS LAST
        LIMIT 50
      `,
      // Remunerações deste usuário (comissões, salário, bonificações)
      sql`
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
        JOIN usuarios u ON u.colaborador_id = r.colaborador_id
        WHERE u.id = ${userId}::uuid
      `,
      // Previsão de remunerações — próximos 6 meses
      sql`
        SELECT
          to_char(date_trunc('month', r.competencia), 'YYYY-MM') AS mes_iso,
          COALESCE(SUM(r.valor), 0) AS entradas
        FROM remuneracoes r
        JOIN usuarios u ON u.colaborador_id = r.colaborador_id
        WHERE u.id = ${userId}::uuid
          AND r.status = 'pendente'
          AND r.competencia >= date_trunc('month', CURRENT_DATE)
          AND r.competencia <  date_trunc('month', CURRENT_DATE) + INTERVAL '6 months'
        GROUP BY 1
        ORDER BY 1
      `,
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

  // Preenche todos os 6 meses mesmo sem remunerações agendadas
  const fluxoMap = new Map<string, number>();
  for (let i = 0; i < 6; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    fluxoMap.set(key, 0);
  }
  for (const r of fluxoRows) {
    const iso = String(r.mes_iso);
    if (fluxoMap.has(iso)) fluxoMap.set(iso, Number(r.entradas));
  }
  const fluxoEscritorio: FluxoMensalItem[] = Array.from(fluxoMap.entries()).map(
    ([iso, entradas]) => {
      const [y, m] = iso.split("-");
      return {
        mesISO: iso,
        mes: `${MESES_CURTO_DB[Number(m) - 1]}/${y.slice(2)}`,
        entradas,
      };
    }
  );

  return {
    lancamentos: lancamentosRows.map(mapLancamento),
    honorariosEscritorio,
    processosHonorarios,
    escritorioMes,
    fluxoEscritorio,
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
