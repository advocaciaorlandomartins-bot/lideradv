import sql from "./db";

export interface CargaColaborador {
  colaboradorId: string;
  nome: string;
  cargo: string;
  totalAbertas: number;
  totalVencidas: number;
  proximoPrazo: string | null;
  /** Detalhamento do total de abertas por categoria — só entram categorias com total > 0. */
  porCategoria: { categoria: string; label: string; total: number }[];
}

const CATEGORIAS_CARGA: { categoria: string; label: string }[] = [
  { categoria: "audiencias", label: "Audiências" },
  { categoria: "prazos", label: "Prazos" },
  { categoria: "pericias", label: "Perícias" },
  { categoria: "beneficios", label: "Benefícios" },
  { categoria: "servicos", label: "Serviços" },
];

/**
 * Carga de trabalho atual de cada colaborador ativo — quantas tarefas/
 * controles abertos ele tem, quantos já venceram, e o próximo prazo. Usado
 * pra mostrar contexto antes de atribuir uma nova tarefa (não sobrecarregar
 * quem já está no limite). "beneficios" agrupa dcb/beneficios/implantados/
 * implantados-data/alvaras — categorias finas demais pra listar uma a uma
 * sem poluir o painel. "servicos" são as tarefas_processo (ex: "verificar
 * documentação", "dar entrada"), que não são controles.
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
        ) AS proximo_prazo,
        COUNT(*) FILTER (WHERE c.tipo = 'audiencias') AS audiencias,
        COUNT(*) FILTER (WHERE c.tipo = 'prazos') AS prazos,
        COUNT(*) FILTER (WHERE c.tipo = 'pericias') AS pericias,
        COUNT(*) FILTER (
          WHERE c.tipo IN ('dcb', 'beneficios', 'implantados', 'implantados-data', 'alvaras')
        ) AS beneficios
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
      LEAST(cc.proximo_prazo, ct.proximo_prazo) AS proximo_prazo,
      COALESCE(cc.audiencias, 0) AS audiencias,
      COALESCE(cc.prazos, 0) AS prazos,
      COALESCE(cc.pericias, 0) AS pericias,
      COALESCE(cc.beneficios, 0) AS beneficios,
      COALESCE(ct.abertas, 0) AS servicos
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
    porCategoria: CATEGORIAS_CARGA.map(({ categoria, label }) => ({
      categoria,
      label,
      total: Number(r[categoria] ?? 0),
    })).filter((c) => c.total > 0),
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
      SELECT date_trunc('week', criado_em)::date::text AS semana, COUNT(*)::int AS n
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
      SELECT date_trunc('week', criado_em)::date::text AS semana, COUNT(*)::int AS n
      FROM pontuacao_eventos
      WHERE criado_em >= NOW() - (${semanas} || ' weeks')::interval
      GROUP BY 1
      ORDER BY 1
    `,
  ]);

  // date_trunc(...)::date volta como objeto Date do driver, não string — usar
  // String(date).slice(0,10) pega "Mon Aug 10" (toString() do JS Date), não
  // o ISO "YYYY-MM-DD". Isso ordenava as semanas alfabeticamente por nome do
  // dia/mês em vez de cronologicamente. ::text já converte no Postgres, que
  // devolve o formato ISO certo independente do driver.
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

export interface CapacidadeSemanaComFila extends CapacidadeSemana {
  filaAcumulada: number;
}

export interface CapacidadeResumo {
  semanas: CapacidadeSemanaComFila[];
  filaAtual: number;
  entradaMediaRecente: number;
  saidaMediaRecente: number;
  saldoMedioRecente: number;
  entradaVariacaoPct: number | null;
  saidaVariacaoPct: number | null;
  narrativa: string;
}

function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior === 0) return null;
  return Math.round(((atual - anterior) / anterior) * 100);
}

/**
 * Mesmo dado de getCapacidadeProdutiva, mas com fila acumulada (saldo
 * corrido de entraram-saidas semana a semana) e uma narrativa automática
 * comparando as últimas semanas com as anteriores — mesma ressalva de
 * dados: semanas antes do ledger de conclusão existir mostram "saidas"
 * zerado, o que infla a fila acumulada ali por falta de histórico, não por
 * atraso real da equipe.
 */
export async function getCapacidadeResumo(
  semanas = 8
): Promise<CapacidadeResumo> {
  const semanasBase = await getCapacidadeProdutiva(semanas);

  let acumulado = 0;
  const comFila: CapacidadeSemanaComFila[] = semanasBase.map((s) => {
    acumulado += s.entraram - s.saidas;
    return { ...s, filaAcumulada: Math.max(0, acumulado) };
  });

  const n = comFila.length;
  const recentes = comFila.slice(Math.max(0, n - 3));
  const anteriores = comFila.slice(Math.max(0, n - 6), Math.max(0, n - 3));

  const media = (
    arr: CapacidadeSemanaComFila[],
    campo: "entraram" | "saidas"
  ) =>
    arr.length === 0 ? 0 : arr.reduce((s, c) => s + c[campo], 0) / arr.length;

  const entradaMediaRecente = media(recentes, "entraram");
  const saidaMediaRecente = media(recentes, "saidas");
  const entradaMediaAnterior = media(anteriores, "entraram");
  const saidaMediaAnterior = media(anteriores, "saidas");
  const saldoMedioRecente = entradaMediaRecente - saidaMediaRecente;
  const filaAtual =
    comFila.length > 0 ? comFila[comFila.length - 1].filaAcumulada : 0;

  const entradaVariacaoPct = variacaoPct(
    entradaMediaRecente,
    entradaMediaAnterior
  );
  const saidaVariacaoPct = variacaoPct(saidaMediaRecente, saidaMediaAnterior);

  let narrativa: string;
  if (n === 0 || (entradaMediaRecente === 0 && saidaMediaRecente === 0)) {
    narrativa = "Ainda sem dados suficientes pra avaliar a tendência.";
  } else if (Math.abs(saldoMedioRecente) < 1) {
    narrativa = `A equipe está dando conta do volume. O que entra e o que sai andam no mesmo ritmo — entram ${entradaMediaRecente.toFixed(1)} e saem ${saidaMediaRecente.toFixed(1)} por semana.`;
  } else if (saldoMedioRecente > 0) {
    narrativa = `A fila está crescendo. Entram ${entradaMediaRecente.toFixed(1)} e saem ${saidaMediaRecente.toFixed(1)} por semana — saldo de +${saldoMedioRecente.toFixed(1)} acumulando por semana.`;
  } else {
    narrativa = `A equipe está reduzindo a fila. Entram ${entradaMediaRecente.toFixed(1)} e saem ${saidaMediaRecente.toFixed(1)} por semana — saldo de ${saldoMedioRecente.toFixed(1)} por semana.`;
  }

  return {
    semanas: comFila,
    filaAtual,
    entradaMediaRecente,
    saidaMediaRecente,
    saldoMedioRecente,
    entradaVariacaoPct,
    saidaVariacaoPct,
    narrativa,
  };
}
