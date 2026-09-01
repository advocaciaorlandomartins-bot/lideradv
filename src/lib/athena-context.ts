import { getRanking } from "./pontuacao";
import {
  getCargaColaboradores,
  getCapacidadeProdutiva,
} from "./controladoria-db";

/**
 * Snapshot textual dos dados reais da controladoria, embutido no prompt da
 * Athena — mesma informação que já aparece no painel Controladoria (mesmo
 * gate de permissão), só que em formato pra IA responder perguntas em
 * linguagem natural sobre ela. Sem tool-calling: busca tudo de uma vez antes
 * da chamada, suficiente pro volume de dados de um escritório.
 */
export async function buildAthenaContextText(): Promise<string> {
  const [ranking30, carga, capacidade] = await Promise.all([
    getRanking(30),
    getCargaColaboradores(),
    getCapacidadeProdutiva(4),
  ]);

  const rankingTxt =
    ranking30.length === 0
      ? "Sem dados de pontuação ainda."
      : ranking30
          .map(
            (r, i) =>
              `${i + 1}. ${r.nome} (${r.cargo}) — ${r.totalPontos} pontos, ${r.entregas} entregas`
          )
          .join("\n");

  const cargaTxt =
    carga.length === 0
      ? "Sem colaboradores ativos com itens abertos."
      : carga
          .map(
            (c) =>
              `${c.nome} (${c.cargo}): ${c.totalAbertas} abertas${c.totalVencidas > 0 ? `, ${c.totalVencidas} VENCIDAS` : ""}${c.proximoPrazo ? `, próximo prazo ${c.proximoPrazo}` : ""}`
          )
          .join("\n");

  const capacidadeTxt =
    capacidade.length === 0
      ? "Sem dados de capacidade produtiva ainda."
      : capacidade
          .map(
            (c) =>
              `Semana ${c.semana}: ${c.entraram} entraram, ${c.saidas} concluídas`
          )
          .join("\n");

  return `━━━ RANKING (últimos 30 dias) ━━━
${rankingTxt}

━━━ CARGA DA EQUIPE (itens abertos agora) ━━━
${cargaTxt}

━━━ CAPACIDADE PRODUTIVA (últimas 4 semanas) ━━━
${capacidadeTxt}`;
}
