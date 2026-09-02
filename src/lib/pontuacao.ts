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

export type ClassificacaoEntrega =
  | "adiantado"
  | "no_limite"
  | "atrasado"
  | "sem_prazo";

export interface EntregaClassificada {
  id: string;
  titulo: string;
  concluidoEm: string;
  prazoInterno: string | null;
  prazoFinal: string | null;
  classificacao: ClassificacaoEntrega;
}

export interface RankingDetalhado extends RankingItem {
  /** % das entregas do período com prazo definido que foram concluídas até o prazo final (null = sem entregas com prazo pra medir). */
  noPrazoPct: number | null;
  /** Controles marcados "prazo fatal", ainda abertos e já vencidos — sob responsabilidade desse colaborador agora. */
  fataisAbertos: number;
  /** Entregas do período, do mais recente pro mais antigo, já classificadas — pra cobrar com item e data na mão, não só um percentual solto. */
  historico: EntregaClassificada[];
  adiantados: number;
  noLimite: number;
  atrasados: number;
}

/**
 * O histórico traz título do item concluído (e, indiretamente, contexto do
 * cliente pra quem escreve a descrição) — quem não tem processos_ver_todos
 * só pode ver esse nível de detalhe do próprio trabalho, não do de todo
 * mundo (mesma regra de escopo usada em processos/Cérebro Jurídico). Os
 * agregados (pontos, % no prazo, contagens) continuam visíveis pra todo
 * mundo — só o histórico item-a-item é restrito.
 */
export function filtrarHistoricoPorPermissao(
  ranking: RankingDetalhado[],
  podeVerDetalhesDeTodos: boolean,
  meuColaboradorId: string | null
): RankingDetalhado[] {
  if (podeVerDetalhesDeTodos) return ranking;
  return ranking.map((r) =>
    r.colaboradorId === meuColaboradorId ? r : { ...r, historico: [] }
  );
}

function classificarEntrega(
  concluidoEm: string,
  prazoInterno: string | null,
  prazoFinal: string | null
): ClassificacaoEntrega {
  if (!prazoInterno && !prazoFinal) return "sem_prazo";
  if (prazoFinal && concluidoEm > prazoFinal) return "atrasado";
  if (prazoInterno && concluidoEm <= prazoInterno) return "adiantado";
  return "no_limite";
}

/**
 * Versão mais rica do ranking pro painel Controladoria: além de pontos/
 * entregas, classifica cada entrega do período em 3 níveis — "adiantado"
 * (concluído até o prazo interno, o prazo ideal/de folga), "no_limite"
 * (concluído depois do prazo interno mas ainda dentro do prazo final, ou
 * sem prazo interno cadastrado — só dá pra saber que cumpriu o prazo real)
 * e "atrasado" (concluído depois do prazo final) — e quantos prazos fatais
 * esse colaborador tem em aberto e já vencidos agora (sinal de atenção
 * imediata, não histórico).
 */
export async function getRankingDetalhado(
  dias = 30
): Promise<RankingDetalhado[]> {
  const [entregasRows, fataisRows, colaboradores] = await Promise.all([
    sql`
      SELECT
        pe.id::text, pe.colaborador_id::text AS colaborador_id, pe.titulo, pe.pontos,
        pe.criado_em::date::text AS concluido_em,
        CASE WHEN pe.origem_tipo = 'controle' THEN c.prazo_interno::text ELSE NULL END AS prazo_interno,
        CASE
          WHEN pe.origem_tipo = 'controle' THEN c.data_evento::text
          ELSE t.prazo::text
        END AS prazo_final
      FROM pontuacao_eventos pe
      LEFT JOIN controles c ON pe.origem_tipo = 'controle' AND c.id = pe.origem_id
      LEFT JOIN tarefas_processo t ON pe.origem_tipo = 'tarefa_processo' AND t.id = pe.origem_id
      WHERE pe.criado_em >= NOW() - (${dias} || ' days')::interval
      ORDER BY pe.criado_em DESC
    `,
    sql`
      SELECT u.colaborador_id::text AS colaborador_id, COUNT(*)::int AS total
      FROM controles c
      JOIN usuarios u ON u.id = c.responsavel_id
      WHERE c.fatal = TRUE AND c.status IS NULL AND c.data_evento < CURRENT_DATE
      GROUP BY u.colaborador_id
    `,
    sql`SELECT id::text, nome, cargo FROM colaboradores WHERE status = 'ativo'`,
  ]);

  const fataisPorColaborador = new Map(
    fataisRows.map((r) => [String(r.colaborador_id), Number(r.total)])
  );

  const historicoPorColaborador = new Map<string, EntregaClassificada[]>();
  for (const r of entregasRows) {
    const prazoInterno = r.prazo_interno
      ? String(r.prazo_interno).slice(0, 10)
      : null;
    const prazoFinal = r.prazo_final
      ? String(r.prazo_final).slice(0, 10)
      : null;
    const concluidoEm = String(r.concluido_em).slice(0, 10);
    const item: EntregaClassificada = {
      id: String(r.id),
      titulo: String(r.titulo),
      concluidoEm,
      prazoInterno,
      prazoFinal,
      classificacao: classificarEntrega(concluidoEm, prazoInterno, prazoFinal),
    };
    const colaboradorId = String(r.colaborador_id);
    const arr = historicoPorColaborador.get(colaboradorId) ?? [];
    arr.push(item);
    historicoPorColaborador.set(colaboradorId, arr);
  }

  const pontosPorColaborador = new Map<
    string,
    { pontos: number; entregas: number }
  >();
  for (const r of entregasRows) {
    const colaboradorId = String(r.colaborador_id);
    const acc = pontosPorColaborador.get(colaboradorId) ?? {
      pontos: 0,
      entregas: 0,
    };
    acc.pontos += Number(r.pontos);
    acc.entregas += 1;
    pontosPorColaborador.set(colaboradorId, acc);
  }

  return colaboradores
    .map((col) => {
      const colaboradorId = String(col.id);
      const historico = historicoPorColaborador.get(colaboradorId) ?? [];
      const agg = pontosPorColaborador.get(colaboradorId) ?? {
        pontos: 0,
        entregas: 0,
      };
      const adiantados = historico.filter(
        (h) => h.classificacao === "adiantado"
      ).length;
      const noLimite = historico.filter(
        (h) => h.classificacao === "no_limite"
      ).length;
      const atrasados = historico.filter(
        (h) => h.classificacao === "atrasado"
      ).length;
      const comPrazo = adiantados + noLimite + atrasados;
      return {
        colaboradorId,
        nome: String(col.nome),
        cargo: String(col.cargo),
        totalPontos: agg.pontos,
        entregas: agg.entregas,
        noPrazoPct:
          comPrazo > 0
            ? Math.round(((adiantados + noLimite) / comPrazo) * 100)
            : null,
        fataisAbertos: fataisPorColaborador.get(colaboradorId) ?? 0,
        historico,
        adiantados,
        noLimite,
        atrasados,
      };
    })
    .sort((a, b) => b.totalPontos - a.totalPontos || b.entregas - a.entregas);
}
