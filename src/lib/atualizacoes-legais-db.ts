import "server-only";
import sql from "./db";

export interface AtualizacaoLegalResumo {
  id: string;
  titulo: string;
  resumo: string | null;
  dataPublicacao: string;
  orgao: string | null;
  impacto: "alto" | "medio" | "baixo";
  oQueMuda: string | null;
  acaoRecomendada: string | null;
  tiposAfetados: string[];
  url: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): AtualizacaoLegalResumo {
  return {
    id: String(r.id),
    titulo: String(r.titulo),
    resumo: r.resumo ? String(r.resumo) : null,
    dataPublicacao: String(r.data_publicacao).slice(0, 10),
    orgao: r.orgao ? String(r.orgao) : null,
    impacto: (r.impacto as "alto" | "medio" | "baixo") ?? "baixo",
    oQueMuda: r.o_que_muda ? String(r.o_que_muda) : null,
    acaoRecomendada: r.acao_recomendada ? String(r.acao_recomendada) : null,
    tiposAfetados: Array.isArray(r.tipos_afetados)
      ? r.tipos_afetados.map(String)
      : [],
    url: r.url ? String(r.url) : null,
  };
}

/**
 * Mudanças legais/normativas recentes (INSS, Previdência, DOU) que afetam
 * benefícios previdenciários — já classificadas por impacto e com "o que
 * muda na prática" pela análise automática do cron diário
 * (/api/cron/atualizacoes-legais). Consultada pela Íris e pelo gerador de
 * petições pra evitar responder com regra desatualizada quando algo mudou
 * recentemente (ex: nova instrução normativa de carência/cálculo).
 *
 * tiposAfetados: filtra por tipo de benefício (ex: "bpc_loas",
 * "auxilio_doenca") quando informado; sem filtro, traz as mudanças de
 * impacto alto/médio mais recentes de qualquer tipo.
 */
export async function getAtualizacoesLegaisRecentes(
  tiposAfetados?: string[],
  dias = 180,
  limite = 8
): Promise<AtualizacaoLegalResumo[]> {
  const rows =
    tiposAfetados && tiposAfetados.length > 0
      ? await sql`
          SELECT id::text, titulo, resumo, data_publicacao::text, orgao,
                 impacto, o_que_muda, acao_recomendada, tipos_afetados, url
          FROM atualizacoes_legais
          WHERE data_publicacao >= CURRENT_DATE - (${dias} || ' days')::interval
            AND impacto IN ('alto', 'medio')
            AND tipos_afetados && ${tiposAfetados}::text[]
          ORDER BY data_publicacao DESC
          LIMIT ${limite}
        `
      : await sql`
          SELECT id::text, titulo, resumo, data_publicacao::text, orgao,
                 impacto, o_que_muda, acao_recomendada, tipos_afetados, url
          FROM atualizacoes_legais
          WHERE data_publicacao >= CURRENT_DATE - (${dias} || ' days')::interval
            AND impacto IN ('alto', 'medio')
          ORDER BY data_publicacao DESC
          LIMIT ${limite}
        `;
  return rows.map(mapRow);
}

/** Formata pra injetar direto num prompt de IA — usado pela Íris e pelo Dr. Lex. */
export function formatarAtualizacoesLegaisTexto(
  itens: AtualizacaoLegalResumo[]
): string {
  if (itens.length === 0)
    return "Nenhuma mudança legal/normativa de impacto alto ou médio registrada nos últimos meses pra esse filtro.";
  return itens
    .map(
      (a) =>
        `[${a.impacto.toUpperCase()}] ${a.dataPublicacao} — ${a.titulo} (${a.orgao ?? "fonte não identificada"})\nO que muda: ${a.oQueMuda ?? "—"}\nAção recomendada: ${a.acaoRecomendada ?? "—"}`
    )
    .join("\n\n");
}
