import "server-only";
import sql from "./db";
import { getCargaColaboradores } from "./controladoria-db";
import { getCronsAtrasados, getLoginFalhosRecentes } from "./saude-sistema";
import { getAtualizacoesLegaisRecentes } from "./atualizacoes-legais-db";
import { enviarMensagemDireta } from "./prevbot-outbound";
import { getAllProcessosProducao } from "./producao-db";
import { getLancamentoKpis } from "./lancamentos-db";
import { getClientesAguardandoResposta } from "./prevbot-status";

// Nenhum SLA/tempo médio por estágio existe no sistema hoje — 30 dias é um
// limiar de bom senso ("ninguém tocou nisso há um mês"), não um cálculo.
// Ajustável aqui sem mexer em mais nada.
const DIAS_PROCESSO_PARADO = 30;

/**
 * Alerta imediato (não espera o resumo do dia seguinte) quando um controle é
 * marcado prazo fatal — criado assim ou editado passando a ser fatal. Só
 * quem chama decide QUANDO disparar (na transição false→true); esta função
 * só monta e manda a mensagem.
 */
export async function alertarPrazoFatalNovo(
  descricao: string,
  dataEvento: string | null,
  clienteNome: string | null
): Promise<void> {
  try {
    const [cfg] = await sql`SELECT telefone FROM escritorio_config LIMIT 1`;
    const telefone = String(cfg?.telefone ?? "").trim();
    if (!telefone) return;
    const dataFmt = dataEvento
      ? new Date(dataEvento + "T00:00:00").toLocaleDateString("pt-BR")
      : "sem data definida";
    const msg =
      `🚨 *Novo prazo fatal registrado*\n\n${descricao}` +
      `${clienteNome ? `\nCliente: ${clienteNome}` : ""}` +
      `\nData: ${dataFmt}` +
      `\n\nAcesse LiderAdv para conferir.`;
    await enviarMensagemDireta({ telefone, mensagem: msg });
  } catch (err) {
    console.error("[alertarPrazoFatalNovo] falha ao enviar:", err);
  }
}

/**
 * Resumo diário mandado por WhatsApp pro escritório (cron/lembretes, 08h) —
 * junta em uma mensagem só o que já existia espalhado (prazos fatais, carga
 * da equipe, saúde dos crons, atualizações legais de impacto) e que hoje só
 * aparecia se alguém abrisse a tela certa e perguntasse. Curto de propósito:
 * se virar textão todo dia, para de ser lido.
 */
export async function montarResumoDiario(): Promise<string | null> {
  const [
    prazosFatais,
    carga,
    cronsStatus,
    loginsFalhos,
    atualizacoes,
    processos,
    financeiro,
    clientesSemResposta,
    valorAtrasadoRows,
  ] = await Promise.all([
    sql`
        SELECT c.descricao, c.data_evento::text AS data, cl.name AS cliente_nome
        FROM controles c
        LEFT JOIN clients cl ON cl.id = c.cliente_id
        WHERE c.status IS NULL
          AND c.fatal = TRUE
          AND c.data_evento IS NOT NULL
          AND c.data_evento <= CURRENT_DATE + INTERVAL '2 days'
        ORDER BY c.data_evento ASC
        LIMIT 15
      `,
    getCargaColaboradores(),
    getCronsAtrasados(),
    getLoginFalhosRecentes(24),
    getAtualizacoesLegaisRecentes(undefined, 2, 5),
    getAllProcessosProducao(),
    getLancamentoKpis(),
    getClientesAguardandoResposta().catch(() => []),
    // getLancamentoKpis só conta atrasados, não soma o valor — mesma
    // definição de "atrasado" que ela usa (pendente, tipo entrada, vencido,
    // ignorando a data-sentinela 9998-01-01 de "sem vencimento definido").
    sql`
        SELECT COALESCE(SUM(valor), 0) AS total
        FROM lancamentos
        WHERE tipo = 'entrada' AND status = 'pendente'
          AND data_vencimento < CURRENT_DATE
          AND data_vencimento < '9998-01-01'
      `,
  ]);

  const hojeISO = new Date().toISOString().slice(0, 10);
  const linhas: string[] = [];

  if (prazosFatais.length > 0) {
    linhas.push(`⚠️ *${prazosFatais.length} prazo(s) fatal(is) crítico(s):*`);
    for (const p of prazosFatais) {
      const data = String(p.data);
      const marcador =
        data < hojeISO
          ? "VENCIDO"
          : data === hojeISO
            ? "HOJE"
            : "amanhã/depois";
      linhas.push(
        `• [${marcador}] ${p.descricao}${p.cliente_nome ? ` — ${p.cliente_nome}` : ""} (${new Date(data + "T00:00:00").toLocaleDateString("pt-BR")})`
      );
    }
  }

  const vencidasPorColaborador = carga.filter((c) => c.totalVencidas > 0);
  if (vencidasPorColaborador.length > 0) {
    linhas.push("\n📋 *Itens vencidos por colaborador:*");
    for (const c of vencidasPorColaborador) {
      linhas.push(
        `• ${c.nome}: ${c.totalVencidas} vencido(s) de ${c.totalAbertas} aberto(s)`
      );
    }
  }

  const cronsAtrasados = cronsStatus.filter((c) => c.atrasado);
  if (cronsAtrasados.length > 0) {
    linhas.push("\n🔧 *Rotinas automáticas atrasadas:*");
    for (const c of cronsAtrasados) {
      linhas.push(`• ${c.rota} (última: ${c.ultimaExecucao ?? "nunca rodou"})`);
    }
  }

  if (loginsFalhos > 20) {
    linhas.push(
      `\n🔒 *Segurança:* ${loginsFalhos} tentativas de login falhas nas últimas 24h — volume acima do normal.`
    );
  }

  if (atualizacoes.length > 0) {
    linhas.push("\n📰 *Mudanças legais recentes de impacto alto:*");
    for (const a of atualizacoes.slice(0, 3)) {
      linhas.push(`• ${a.titulo}`);
    }
  }

  const processosParados = processos
    .filter(
      (p) =>
        p.estagio_producao !== "arquivado" &&
        p.dias_no_estagio >= DIAS_PROCESSO_PARADO
    )
    .sort((a, b) => b.dias_no_estagio - a.dias_no_estagio);
  if (processosParados.length > 0) {
    linhas.push(
      `\n🐌 *${processosParados.length} processo(s) parado(s) há mais de ${DIAS_PROCESSO_PARADO} dias:*`
    );
    for (const p of processosParados.slice(0, 5)) {
      linhas.push(
        `• ${p.client_name} — ${p.estagio_producao} há ${p.dias_no_estagio} dias${p.responsavel_nome ? ` (${p.responsavel_nome})` : ""}`
      );
    }
    if (processosParados.length > 5)
      linhas.push(`+${processosParados.length - 5} outro(s)`);
  }

  const valorAtrasado = Number(valorAtrasadoRows[0]?.total ?? 0);
  if (financeiro.atrasados > 0) {
    linhas.push(
      `\n💰 *Financeiro:* ${financeiro.atrasados} lançamento(s) em atraso, R$ ${valorAtrasado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Total a receber: R$ ${financeiro.aReceber.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`
    );
  }

  if (clientesSemResposta.length > 0) {
    linhas.push(
      `\n💬 *${clientesSemResposta.length} cliente(s) sem resposta no WhatsApp:*`
    );
    for (const c of clientesSemResposta.slice(0, 5)) {
      linhas.push(`• ${c.clienteNome} — há ${c.diasSemResposta} dia(s)`);
    }
    if (clientesSemResposta.length > 5)
      linhas.push(`+${clientesSemResposta.length - 5} outro(s)`);
  }

  if (linhas.length === 0) {
    return "✅ *Resumo do dia — LiderAdv*\n\nSem pendências críticas hoje. Prazos, equipe e rotinas do sistema em dia.";
  }

  return `📊 *Resumo do dia — LiderAdv*\n\n${linhas.join("\n")}`;
}
