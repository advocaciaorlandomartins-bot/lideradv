import sql from "./db";

/**
 * BI de carteira de processos — inspirado na aba "Controladoria" do
 * concorrente Tramitação Inteligente (documento comparativo de 09/09/2026),
 * mas construído só com o que o LiderAdv tem preenchido de verdade hoje.
 * Campos como valor_causa/assunto/vara/comarca/data_distribuicao estão 100%
 * vazios em produção agora — em vez de simular gráfico bonito em cima de
 * zero dado real, cada painel abaixo expõe quantos processos realmente
 * entraram na conta (`amostra`) e a UI decide como avisar quando isso é 0.
 *
 * colaboradorId: mesma regra de escopo por "processos_ver_todos" já usada
 * em toda a Controladoria/Produção/CRM — null = escritório inteiro.
 */

export interface CarteiraResumo {
  total: number;
  administrativoAtivos: number;
  judicialAtivos: number;
  arquivados: number;
  valorCausaAmostra: number;
  valorCausaSoma: number;
  valorCausaMediana: number | null;
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 === 0 ? (ord[meio - 1] + ord[meio]) / 2 : ord[meio];
}

export async function getCarteiraResumo(
  colaboradorId?: string | null
): Promise<CarteiraResumo> {
  const cid = colaboradorId ?? null;
  const rows = await sql`
    SELECT estagio_producao, valor_causa
    FROM processos
    WHERE deleted_at IS NULL
      AND (${cid}::uuid IS NULL OR responsavel_id = ${cid}::uuid)
  `;
  const valores = rows
    .map((r) => (r.valor_causa != null ? Number(r.valor_causa) : null))
    .filter((v): v is number => v != null);

  return {
    total: rows.length,
    administrativoAtivos: rows.filter(
      (r) => r.estagio_producao === "administrativo"
    ).length,
    judicialAtivos: rows.filter((r) => r.estagio_producao === "judicial")
      .length,
    arquivados: rows.filter((r) => r.estagio_producao === "arquivado").length,
    valorCausaAmostra: valores.length,
    valorCausaSoma: valores.reduce((s, v) => s + v, 0),
    valorCausaMediana: mediana(valores),
  };
}

export interface TipoAcaoRanking {
  tipoAcao: string;
  total: number;
  pct: number;
  valorCausaMediana: number | null;
}

/**
 * Ranking por tipo de ação — usa tipo_acao (100% preenchido) em vez de
 * "assunto" (campo existe no schema mas está 100% vazio em produção).
 * Exclui os "PENDENTE (confirmar tipo de ação)" — são placeholder de
 * cadastro incompleto (import de intimações órfãs), não dado real de
 * carteira, e entrariam como #1 categoria de forma enganosa.
 */
export async function getRankingTipoAcao(
  colaboradorId?: string | null
): Promise<TipoAcaoRanking[]> {
  const cid = colaboradorId ?? null;
  const rows = await sql`
    SELECT tipo_acao, valor_causa
    FROM processos
    WHERE deleted_at IS NULL
      AND tipo_acao NOT ILIKE 'PENDENTE%'
      AND (${cid}::uuid IS NULL OR responsavel_id = ${cid}::uuid)
  `;
  const total = rows.length;
  const porTipo = new Map<string, number[]>();
  for (const r of rows) {
    const key = String(r.tipo_acao);
    const arr = porTipo.get(key) ?? [];
    if (r.valor_causa != null) arr.push(Number(r.valor_causa));
    porTipo.set(key, arr);
  }
  const contagem = new Map<string, number>();
  for (const r of rows) {
    const key = String(r.tipo_acao);
    contagem.set(key, (contagem.get(key) ?? 0) + 1);
  }
  return Array.from(contagem.entries())
    .map(([tipoAcao, n]) => ({
      tipoAcao,
      total: n,
      pct: total > 0 ? Math.round((n / total) * 100) : 0,
      valorCausaMediana: mediana(porTipo.get(tipoAcao) ?? []),
    }))
    .sort((a, b) => b.total - a.total);
}

export interface DesfechosAdministrativos {
  decididos: number;
  concedidos: number;
  negados: number;
  pctExito: number | null;
}

export async function getDesfechosAdministrativos(
  colaboradorId?: string | null
): Promise<DesfechosAdministrativos> {
  const cid = colaboradorId ?? null;
  const rows = await sql`
    SELECT resultado_administrativo
    FROM processos
    WHERE deleted_at IS NULL
      AND resultado_administrativo IS NOT NULL
      AND (${cid}::uuid IS NULL OR responsavel_id = ${cid}::uuid)
  `;
  const concedidos = rows.filter(
    (r) => r.resultado_administrativo === "concedido"
  ).length;
  const negados = rows.filter(
    (r) => r.resultado_administrativo === "negado"
  ).length;
  return {
    decididos: rows.length,
    concedidos,
    negados,
    pctExito:
      rows.length > 0 ? Math.round((concedidos / rows.length) * 100) : null,
  };
}

export interface ClientesResumo {
  total: number;
  comProcessoAtivo: number;
  novosUltimos30d: number;
}

export async function getClientesResumo(
  colaboradorId?: string | null
): Promise<ClientesResumo> {
  const cid = colaboradorId ?? null;
  // Sem processos_ver_todos, "clientes" continua não-restrito (mesma regra
  // já usada em /dashboard/clientes) — só "com processo ativo" é que
  // precisa saber de responsável, porque é derivado de processos.
  const [totalRows, ativosRows, novosRows] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM clients WHERE deleted_at IS NULL`,
    sql`
      SELECT COUNT(DISTINCT client_id)::int AS n
      FROM processos
      WHERE deleted_at IS NULL
        AND estagio_producao != 'arquivado'
        AND (${cid}::uuid IS NULL OR responsavel_id = ${cid}::uuid)
    `,
    sql`
      SELECT COUNT(*)::int AS n FROM clients
      WHERE deleted_at IS NULL AND created_at >= NOW() - INTERVAL '30 days'
    `,
  ]);
  return {
    total: Number(totalRows[0].n),
    comProcessoAtivo: Number(ativosRows[0].n),
    novosUltimos30d: Number(novosRows[0].n),
  };
}

export interface ClientesPorMes {
  mes: string; // YYYY-MM
  novos: number;
}

export async function getClientesPorMes(meses = 24): Promise<ClientesPorMes[]> {
  const rows = await sql`
    SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS mes, COUNT(*)::int AS n
    FROM clients
    WHERE deleted_at IS NULL
      AND created_at >= date_trunc('month', NOW()) - (${meses - 1} || ' months')::interval
    GROUP BY 1
    ORDER BY 1
  `;
  return rows.map((r) => ({ mes: String(r.mes), novos: Number(r.n) }));
}

export interface UFRanking {
  uf: string;
  total: number;
  pct: number;
}

export interface CidadeRanking {
  cidade: string;
  uf: string;
  total: number;
}

export async function getClientesPorUF(): Promise<{
  porUF: UFRanking[];
  cidades: CidadeRanking[];
  semUF: number;
}> {
  const [ufRows, cidadeRows, semUFRows] = await Promise.all([
    sql`
      SELECT state, COUNT(*)::int AS n FROM clients
      WHERE deleted_at IS NULL AND state IS NOT NULL AND state != '' AND state != '--'
      GROUP BY state ORDER BY n DESC
    `,
    sql`
      SELECT city, state, COUNT(*)::int AS n FROM clients
      WHERE deleted_at IS NULL AND city IS NOT NULL AND city != '' AND city != 'PENDENTE'
      GROUP BY city, state ORDER BY n DESC LIMIT 10
    `,
    sql`
      SELECT COUNT(*)::int AS n FROM clients
      WHERE deleted_at IS NULL AND (state IS NULL OR state = '' OR state = '--')
    `,
  ]);
  const total = ufRows.reduce((s, r) => s + Number(r.n), 0);
  return {
    porUF: ufRows.map((r) => ({
      uf: String(r.state),
      total: Number(r.n),
      pct: total > 0 ? Math.round((Number(r.n) / total) * 100) : 0,
    })),
    cidades: cidadeRows.map((r) => ({
      cidade: String(r.city),
      uf: String(r.state ?? ""),
      total: Number(r.n),
    })),
    semUF: Number(semUFRows[0].n),
  };
}

export interface OrigemRanking {
  origem: string;
  total: number;
  pct: number;
}

const ORIGEM_LABEL: Record<string, string> = {
  indicacao: "Indicação",
  site: "Site / Google",
  redes_sociais: "Redes Sociais",
  evento: "Evento",
  escritorio: "Escritório",
  outro: "Outro",
};

export async function getClientesPorOrigem(): Promise<{
  ranking: OrigemRanking[];
  semOrigem: number;
}> {
  const [rows, semRows] = await Promise.all([
    sql`
      SELECT origem_tipo, COUNT(*)::int AS n FROM clients
      WHERE deleted_at IS NULL AND origem_tipo IS NOT NULL
      GROUP BY origem_tipo ORDER BY n DESC
    `,
    sql`
      SELECT COUNT(*)::int AS n FROM clients
      WHERE deleted_at IS NULL AND origem_tipo IS NULL
    `,
  ]);
  const total = rows.reduce((s, r) => s + Number(r.n), 0);
  return {
    ranking: rows.map((r) => ({
      origem: ORIGEM_LABEL[String(r.origem_tipo)] ?? String(r.origem_tipo),
      total: Number(r.n),
      pct: total > 0 ? Math.round((Number(r.n) / total) * 100) : 0,
    })),
    semOrigem: Number(semRows[0].n),
  };
}
