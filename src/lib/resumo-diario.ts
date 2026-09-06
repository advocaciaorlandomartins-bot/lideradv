import "server-only";
import sql from "./db";
import { getCargaColaboradores } from "./controladoria-db";
import { getCronsAtrasados, getLoginFalhosRecentes } from "./saude-sistema";
import { getAtualizacoesLegaisRecentes } from "./atualizacoes-legais-db";
import { enviarMensagemDireta } from "./prevbot-outbound";

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
  const [prazosFatais, carga, cronsStatus, loginsFalhos, atualizacoes] =
    await Promise.all([
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

  if (linhas.length === 0) {
    return "✅ *Resumo do dia — LiderAdv*\n\nSem pendências críticas hoje. Prazos, equipe e rotinas do sistema em dia.";
  }

  return `📊 *Resumo do dia — LiderAdv*\n\n${linhas.join("\n")}`;
}
