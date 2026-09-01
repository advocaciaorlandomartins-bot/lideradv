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
