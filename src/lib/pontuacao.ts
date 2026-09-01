import sql from "./db";

export type OrigemPontuacao = "controle" | "tarefa_processo";

/**
 * Registra os pontos de uma tarefa/controle no momento em que é concluído.
 * Idempotente (UNIQUE em pontuacao_eventos) — chamar de novo pro mesmo item
 * não pontua duas vezes. Sem responsável definido, não pontua (não tem quem
 * atribuir o ponto). Nunca lança — pontuação é um bônus sobre a ação
 * principal, uma falha aqui não pode impedir dar baixa na tarefa de verdade.
 */
export async function registrarPontosConclusao(
  origemTipo: OrigemPontuacao,
  origemId: string
): Promise<void> {
  try {
    if (origemTipo === "controle") {
      const [row] = await sql`
        SELECT c.pontos, c.tipo_demanda, c.descricao,
               u.colaborador_id::text AS colaborador_id
        FROM controles c
        LEFT JOIN usuarios u ON u.id = c.responsavel_id
        WHERE c.id = ${origemId}::uuid
      `;
      if (!row?.colaborador_id) return;
      await sql`
        INSERT INTO pontuacao_eventos (colaborador_id, origem_tipo, origem_id, titulo, pontos)
        VALUES (
          ${row.colaborador_id}::uuid,
          'controle',
          ${origemId}::uuid,
          ${String(row.descricao || row.tipo_demanda || "Controle").slice(0, 255)},
          ${row.pontos}
        )
        ON CONFLICT (origem_tipo, origem_id) DO NOTHING
      `;
    } else {
      // tarefas_processo.responsavel é nome livre (sem FK) — resolve pelo
      // nome do colaborador ativo, mesmo casamento já usado em
      // minhas-tarefas-db.ts.
      const [row] = await sql`
        SELECT t.pontos, t.titulo,
               col.id::text AS colaborador_id
        FROM tarefas_processo t
        LEFT JOIN colaboradores col
          ON col.nome = t.responsavel AND col.status = 'ativo'
        WHERE t.id = ${origemId}::uuid
      `;
      if (!row?.colaborador_id) return;
      await sql`
        INSERT INTO pontuacao_eventos (colaborador_id, origem_tipo, origem_id, titulo, pontos)
        VALUES (
          ${row.colaborador_id}::uuid,
          'tarefa_processo',
          ${origemId}::uuid,
          ${String(row.titulo).slice(0, 255)},
          ${row.pontos}
        )
        ON CONFLICT (origem_tipo, origem_id) DO NOTHING
      `;
    }
  } catch (e) {
    console.error("[pontuacao] falha ao registrar pontos:", e);
  }
}

/**
 * Reverte a pontuação de um item reaberto — reabrir e concluir de novo
 * pontua de novo (não é dobrar, é corrigir: o item voltou a ser trabalho
 * pendente).
 */
export async function reverterPontosConclusao(
  origemTipo: OrigemPontuacao,
  origemId: string
): Promise<void> {
  await sql`
    DELETE FROM pontuacao_eventos
    WHERE origem_tipo = ${origemTipo} AND origem_id = ${origemId}::uuid
  `.catch((e) => {
    console.error("[pontuacao] falha ao reverter pontos:", e);
  });
}

export interface RankingItem {
  colaboradorId: string;
  nome: string;
  cargo: string;
  totalPontos: number;
  entregas: number;
}

export async function getRanking(dias = 30): Promise<RankingItem[]> {
  const rows = await sql`
    SELECT
      col.id::text AS colaborador_id,
      col.nome,
      col.cargo,
      COALESCE(SUM(pe.pontos), 0)::int AS total_pontos,
      COUNT(pe.id)::int AS entregas
    FROM colaboradores col
    LEFT JOIN pontuacao_eventos pe
      ON pe.colaborador_id = col.id
      AND pe.criado_em >= NOW() - (${dias} || ' days')::interval
    WHERE col.status = 'ativo'
    GROUP BY col.id, col.nome, col.cargo
    ORDER BY total_pontos DESC, entregas DESC
  `;
  return rows.map((r) => ({
    colaboradorId: String(r.colaborador_id),
    nome: String(r.nome),
    cargo: String(r.cargo),
    totalPontos: Number(r.total_pontos),
    entregas: Number(r.entregas),
  }));
}

export interface RankingDetalhado extends RankingItem {
  /** % das entregas do período que foram concluídas até o prazo (null = sem entregas com prazo definido pra medir). */
  noPrazoPct: number | null;
  /** Controles marcados "prazo fatal", ainda abertos e já vencidos — sob responsabilidade desse colaborador agora. */
  fataisAbertos: number;
}

/**
 * Versão mais rica do ranking pro painel Controladoria: além de pontos/
 * entregas, calcula % de entregas feitas dentro do prazo (compara a data de
 * conclusão registrada em pontuacao_eventos com o prazo original do
 * controle/tarefa) e quantos prazos fatais esse colaborador tem em aberto
 * e já vencidos agora — sinal de atenção imediata, não histórico.
 */
export async function getRankingDetalhado(
  dias = 30
): Promise<RankingDetalhado[]> {
  const rows = await sql`
    WITH entregas_no_prazo AS (
      SELECT
        pe.colaborador_id,
        COUNT(*) FILTER (
          WHERE (pe.origem_tipo = 'controle' AND c.data_evento IS NOT NULL AND pe.criado_em::date <= c.data_evento)
             OR (pe.origem_tipo = 'tarefa_processo' AND t.prazo IS NOT NULL AND pe.criado_em::date <= t.prazo)
        )::int AS no_prazo,
        COUNT(*) FILTER (
          WHERE (pe.origem_tipo = 'controle' AND c.data_evento IS NOT NULL)
             OR (pe.origem_tipo = 'tarefa_processo' AND t.prazo IS NOT NULL)
        )::int AS com_prazo_definido
      FROM pontuacao_eventos pe
      LEFT JOIN controles c ON pe.origem_tipo = 'controle' AND c.id = pe.origem_id
      LEFT JOIN tarefas_processo t ON pe.origem_tipo = 'tarefa_processo' AND t.id = pe.origem_id
      WHERE pe.criado_em >= NOW() - (${dias} || ' days')::interval
      GROUP BY pe.colaborador_id
    ),
    fatais_abertos AS (
      SELECT u.colaborador_id, COUNT(*)::int AS total
      FROM controles c
      JOIN usuarios u ON u.id = c.responsavel_id
      WHERE c.fatal = TRUE AND c.status IS NULL AND c.data_evento < CURRENT_DATE
      GROUP BY u.colaborador_id
    )
    SELECT
      col.id::text AS colaborador_id,
      col.nome,
      col.cargo,
      COALESCE(SUM(pe.pontos), 0)::int AS total_pontos,
      COUNT(pe.id)::int AS entregas,
      enp.no_prazo,
      enp.com_prazo_definido,
      COALESCE(fa.total, 0) AS fatais_abertos
    FROM colaboradores col
    LEFT JOIN pontuacao_eventos pe
      ON pe.colaborador_id = col.id
      AND pe.criado_em >= NOW() - (${dias} || ' days')::interval
    LEFT JOIN entregas_no_prazo enp ON enp.colaborador_id = col.id
    LEFT JOIN fatais_abertos fa ON fa.colaborador_id = col.id
    WHERE col.status = 'ativo'
    GROUP BY col.id, col.nome, col.cargo, enp.no_prazo, enp.com_prazo_definido, fa.total
    ORDER BY total_pontos DESC, entregas DESC
  `;
  return rows.map((r) => ({
    colaboradorId: String(r.colaborador_id),
    nome: String(r.nome),
    cargo: String(r.cargo),
    totalPontos: Number(r.total_pontos),
    entregas: Number(r.entregas),
    noPrazoPct:
      r.com_prazo_definido != null && Number(r.com_prazo_definido) > 0
        ? Math.round((Number(r.no_prazo) / Number(r.com_prazo_definido)) * 100)
        : null,
    fataisAbertos: Number(r.fatais_abertos),
  }));
}
