import sql from "./db";

export interface CargaColaborador {
  colaboradorId: string;
  nome: string;
  cargo: string;
  totalAbertas: number;
  totalVencidas: number;
  proximoPrazo: string | null;
}

/**
 * Carga de trabalho atual de cada colaborador ativo — quantas tarefas/
 * controles abertos ele tem, quantos já venceram, e o próximo prazo. Usado
 * pra mostrar contexto antes de atribuir uma nova tarefa (não sobrecarregar
 * quem já está no limite).
 */
export async function getCargaColaboradores(): Promise<CargaColaborador[]> {
  const rows = await sql`
    WITH carga_controles AS (
      SELECT
        u.colaborador_id,
        COUNT(*) AS abertas,
        COUNT(*) FILTER (
          WHERE COALESCE(c.prazo_interno, c.data_evento) < CURRENT_DATE
        ) AS vencidas,
        MIN(COALESCE(c.prazo_interno, c.data_evento)) FILTER (
          WHERE COALESCE(c.prazo_interno, c.data_evento) >= CURRENT_DATE
        ) AS proximo_prazo
      FROM controles c
      JOIN usuarios u ON u.id = c.responsavel_id
      WHERE c.status IS NULL
      GROUP BY u.colaborador_id
    ),
    carga_tarefas AS (
      SELECT
        col.id AS colaborador_id,
        COUNT(*) AS abertas,
        COUNT(*) FILTER (WHERE t.prazo < CURRENT_DATE) AS vencidas,
        MIN(t.prazo) FILTER (WHERE t.prazo >= CURRENT_DATE) AS proximo_prazo
      FROM tarefas_processo t
      JOIN colaboradores col ON col.nome = t.responsavel AND col.status = 'ativo'
      WHERE t.status IN ('Pendente', 'Em andamento')
      GROUP BY col.id
    )
    SELECT
      col.id::text,
      col.nome,
      col.cargo,
      COALESCE(cc.abertas, 0) + COALESCE(ct.abertas, 0) AS total_abertas,
      COALESCE(cc.vencidas, 0) + COALESCE(ct.vencidas, 0) AS total_vencidas,
      LEAST(cc.proximo_prazo, ct.proximo_prazo) AS proximo_prazo
    FROM colaboradores col
    LEFT JOIN carga_controles cc ON cc.colaborador_id = col.id
    LEFT JOIN carga_tarefas ct ON ct.colaborador_id = col.id
    WHERE col.status = 'ativo'
    ORDER BY total_abertas DESC
  `;
  return rows.map((r) => ({
    colaboradorId: String(r.id),
    nome: String(r.nome),
    cargo: String(r.cargo),
    totalAbertas: Number(r.total_abertas),
    totalVencidas: Number(r.total_vencidas),
    proximoPrazo: r.proximo_prazo ? String(r.proximo_prazo).slice(0, 10) : null,
  }));
}

export interface CapacidadeSemana {
  semana: string; // YYYY-MM-DD (segunda-feira da semana)
  entraram: number;
  saidas: number;
}

/**
 * Vazão de trabalho por semana: quanto entrou (tarefas/controles criados)
 * vs. quanto saiu (concluído, via pontuacao_eventos — só existe a partir de
 * quando esse ledger foi criado, então semanas anteriores aparecem com
 * "saidas" zerado por falta de dado histórico, não por bug).
 */
export async function getCapacidadeProdutiva(
  semanas = 8
): Promise<CapacidadeSemana[]> {
  const [entradas, saidas] = await Promise.all([
    sql`
      SELECT date_trunc('week', criado_em)::date AS semana, COUNT(*)::int AS n
      FROM (
        SELECT created_at AS criado_em FROM controles
        WHERE created_at >= NOW() - (${semanas} || ' weeks')::interval
        UNION ALL
        SELECT created_at AS criado_em FROM tarefas_processo
        WHERE created_at >= NOW() - (${semanas} || ' weeks')::interval
      ) x
      GROUP BY 1
      ORDER BY 1
    `,
    sql`
      SELECT date_trunc('week', criado_em)::date AS semana, COUNT(*)::int AS n
      FROM pontuacao_eventos
      WHERE criado_em >= NOW() - (${semanas} || ' weeks')::interval
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  const mapEntradas = new Map<string, number>(
    entradas.map((r) => [String(r.semana).slice(0, 10), Number(r.n)])
  );
  const mapSaidas = new Map<string, number>(
    saidas.map((r) => [String(r.semana).slice(0, 10), Number(r.n)])
  );

  const todasSemanas = Array.from(
    new Set([...mapEntradas.keys(), ...mapSaidas.keys()])
  ).sort();

  return todasSemanas.map((semana) => ({
    semana,
    entraram: mapEntradas.get(semana) ?? 0,
    saidas: mapSaidas.get(semana) ?? 0,
  }));
}
