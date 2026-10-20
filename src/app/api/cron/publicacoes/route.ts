import { NextResponse } from "next/server";
import sql from "@/lib/db";
import {
  buscarPublicacoesPorOab,
  sincronizarMovimentacoesEPublicacoes,
} from "@/lib/datajud";
import { buscarPublicacoesDjeEsaj } from "@/lib/dje-esaj";
import {
  sincronizarTramitaSign,
  sincronizarMovimentacoesTramitaSign,
} from "@/lib/tramitasign-sync";
import { tramitaSignAtivo } from "@/lib/tramitasign";
import { enviarEmailNovaPublicacao } from "@/lib/email";
import { enviarMensagemDireta } from "@/lib/prevbot-outbound";
import { sincronizarDJEN } from "@/lib/djen";

export const dynamic = "force-dynamic";
// Aumentado de 120 pra 280 ao somar o reforço do TramitaSign (cadastro +
// busca de movimentações) ao loop por processo que já tinha o DataJud —
// dobrar as chamadas de rede por processo sem folga de tempo é exatamente
// o que causou o timeout de 300s em produção em 2026-10-17. Cron não tem
// usuário esperando na tela, então pode usar o teto real da plataforma
// (confirmado em produção: até 300s) com margem de segurança.
export const maxDuration = 280;

export async function GET(request: Request) {
  // Autenticação do cron — precisa de CRON_SECRET configurado nas env vars
  // da Vercel (não é definido automaticamente pela plataforma).
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Permite busca histórica via ?dias=N (padrão: 3 para o cron diário)
  const url = new URL(request.url);
  const chamadaExplicita = url.searchParams.has("dias");
  const diasParam = parseInt(url.searchParams.get("dias") ?? "3", 10);
  const diasAtras =
    Number.isFinite(diasParam) && diasParam > 0 && diasParam <= 180
      ? diasParam
      : 3;

  // Sem proteção contra chamada sobreposta no modo automático (ex: retry de
  // quem chama, ou reexecução em cima do disparo agendado) — a notificação
  // de "publicações novas" é baseada em "tudo inserido na última hora", sem
  // marcador de "já notificado"; duas chamadas na mesma janela reenviam
  // WhatsApp/e-mail duplicado do mesmo lote. Só se aplica à chamada
  // automática (sem ?dias=N) — uma busca histórica explícita (ex: backfill
  // manual depois de um período offline) sempre deve rodar, mesmo que o
  // automático tenha acabado de rodar. Achado em auditoria de 2026-10-09.
  if (!chamadaExplicita) {
    const [ultimaExecucao] = await sql`
      SELECT executado_em FROM cron_execucoes
      WHERE rota = '/api/cron/publicacoes'
        AND executado_em >= NOW() - INTERVAL '10 minutes'
      ORDER BY executado_em DESC
      LIMIT 1
    `.catch(() => [] as { executado_em: string }[]);
    if (ultimaExecucao) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        motivo: "já rodou nos últimos 10 minutos",
      });
    }
  }

  // DataJud é opcional — sem a chave, só DJe e TramitaSign rodam
  const apiKey = process.env.DATAJUD_API_KEY ?? null;

  const rows = await sql`
    SELECT id::text, numero, estado, nome_advogado, ativa
    FROM oabs_monitoradas
    WHERE ativa = true
  `;

  if (rows.length === 0) {
    return NextResponse.json({
      ok: true,
      oabs_verificadas: 0,
      publicacoes_novas: 0,
      mensagem:
        "Nenhuma OAB ativa para monitorar. Adicione OABs na aba Publicações > OABs.",
    });
  }

  let totalInseridos = 0;
  const resultados: {
    oab: string;
    estado: string;
    inseridos_datajud: number;
    inseridos_dje: number;
  }[] = [];

  for (const row of rows) {
    const oab = {
      id: String(row.id),
      numero: String(row.numero),
      estado: String(row.estado),
      nome_advogado: row.nome_advogado ? String(row.nome_advogado) : null,
    };
    const inseridosDatajud = apiKey
      ? await buscarPublicacoesPorOab(oab, apiKey, diasAtras)
      : 0;
    const inseridosDje = await buscarPublicacoesDjeEsaj(oab, diasAtras);
    totalInseridos += inseridosDatajud + inseridosDje;
    resultados.push({
      oab: oab.numero,
      estado: oab.estado,
      inseridos_datajud: inseridosDatajud,
      inseridos_dje: inseridosDje,
    });
  }

  // Monitoramento por número de processo via DataJud e/ou TramitaSign
  const tramitaAtivo = tramitaSignAtivo();
  const processos =
    apiKey || tramitaAtivo
      ? await sql`
        SELECT p.id::text, p.numero, c.name AS cliente_nome
        FROM processos p
        LEFT JOIN clients c ON c.id = p.client_id
        WHERE p.numero IS NOT NULL AND p.numero != ''
          AND LENGTH(REGEXP_REPLACE(p.numero, '[^0-9]', '', 'g')) = 20
      `
      : [];

  let processoInseridos = 0;
  let movimentacoesInseridas = 0;
  let movimentacoesTramitaSign = 0;
  const processosResultados: { numero: string; inseridos: number }[] = [];

  if (apiKey) {
    for (const proc of processos) {
      // Publicações + movimentações (histórico processual, aba
      // "Movimentações" do processo) numa ÚNICA requisição ao DataJud por
      // processo — duas requisições separadas aqui dobrava o tempo total
      // do cron e estourou o timeout de 300s do Vercel em produção
      // (2026-10-17).
      const { publicacoesInseridas, movimentacoesInseridas: movsProc } =
        await sincronizarMovimentacoesEPublicacoes(
          String(proc.id),
          String(proc.numero),
          proc.cliente_nome ? String(proc.cliente_nome) : null,
          apiKey,
          diasAtras
        );
      processoInseridos += publicacoesInseridas;
      if (publicacoesInseridas > 0)
        processosResultados.push({
          numero: String(proc.numero),
          inseridos: publicacoesInseridas,
        });
      movimentacoesInseridas += movsProc;
    }
  }

  // Movimentações — reforço do TramitaSign (decisão do Orlando, 2026-10-20):
  // mesma tabela `movimentacoes`, loop separado do DataJud pra não ficar
  // condicionado à DATAJUD_API_KEY existir. Cadastro+busca por processo —
  // é a 2ª fonte de rede por processo neste cron, daí o maxDuration maior.
  if (tramitaAtivo) {
    for (const proc of processos) {
      movimentacoesTramitaSign += await sincronizarMovimentacoesTramitaSign(
        String(proc.id),
        String(proc.numero)
      ).catch((e) => {
        console.error(
          `[cron/publicacoes] Erro TramitaSign movimentações ${proc.numero}:`,
          e
        );
        return 0;
      });
    }
  }

  // TramitaSign: API REST (preferido) → scraping (fallback)
  let tramitaResult: {
    inseridos: number;
    pulados: number;
    metodo?: string;
    erro?: string;
  } = {
    inseridos: 0,
    pulados: 0,
  };
  tramitaResult = await sincronizarTramitaSign(diasAtras);

  // DJEN: busca intimações TRF5 por número de processo (cobre federal)
  const djenInseridos = await sincronizarDJEN(diasAtras).catch((e) => {
    console.error("[cron/publicacoes] Erro DJEN:", e);
    return 0;
  });

  const totalNovas =
    totalInseridos +
    processoInseridos +
    tramitaResult.inseridos +
    djenInseridos;

  // Envia notificações se encontrou publicações novas
  if (totalNovas > 0) {
    try {
      const configRows =
        await sql`SELECT email, telefone FROM escritorio_config LIMIT 1`;
      const cfg = configRows[0] as
        | { email?: string; telefone?: string }
        | undefined;
      const emailDestino = (cfg?.email ?? "").trim();
      const telefoneEscritorio = (cfg?.telefone ?? "").trim();

      // Busca as publicações recém-inseridas (última hora)
      const recentes = await sql`
        SELECT tipo, processo, tribunal, orgao,
               to_char(disponibilizacao, 'DD/MM/YYYY') AS disponibilizacao,
               resumo_ia
        FROM publicacoes
        WHERE created_at >= NOW() - INTERVAL '1 hour'
          AND status = 'nao_lida'
        ORDER BY created_at DESC
        LIMIT 50
      `;

      // WhatsApp para o escritório (canal principal)
      if (telefoneEscritorio && recentes.length > 0) {
        const linhas = recentes.slice(0, 5).map((r) => {
          const ri = r.resumo_ia as { texto?: string } | null;
          const proc = r.processo ? `Proc: ${r.processo}` : "";
          const resumo = ri?.texto ? `\n   ${ri.texto.slice(0, 120)}` : "";
          return `• ${r.tipo} — ${r.tribunal ?? r.orgao ?? ""}${proc ? "\n   " + proc : ""}${resumo}`;
        });
        const resto =
          recentes.length > 5 ? `\n+${recentes.length - 5} mais...` : "";
        const msg =
          `*${totalNovas} nova(s) publicação(ões) no DJe!*\n\n` +
          linhas.join("\n\n") +
          resto +
          `\n\nAcesse LiderAdv para ver todas.`;
        await enviarMensagemDireta({
          telefone: telefoneEscritorio,
          mensagem: msg,
        });
      }

      // E-mail (canal secundário — requer RESEND_API_KEY)
      if (emailDestino && recentes.length > 0) {
        await enviarEmailNovaPublicacao({
          para: emailDestino,
          publicacoes: recentes.map((r) => {
            const ri = r.resumo_ia as {
              texto?: string;
              prazo_dias?: number;
              acao_necessaria?: string;
            } | null;
            return {
              tipo: String(r.tipo),
              processo: String(r.processo),
              tribunal: String(r.tribunal ?? ""),
              orgao: String(r.orgao ?? "—"),
              disponibilizacao: String(r.disponibilizacao),
              resumo: ri?.texto ?? null,
              prazo_dias: ri?.prazo_dias ?? null,
              acao_necessaria: ri?.acao_necessaria ?? null,
            };
          }),
        });
      }
    } catch (err) {
      console.error("[cron/publicacoes] erro ao notificar:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    oabs_verificadas: rows.length,
    publicacoes_novas: totalNovas,
    detalhes: {
      por_oab: resultados,
      por_processo: processosResultados,
      processos_monitorados: processos.length,
      movimentacoes_inseridas: movimentacoesInseridas,
      movimentacoes_inseridas_tramitasign: movimentacoesTramitaSign,
      djen: { inseridos: djenInseridos },
      tramitasign: {
        metodo: tramitaResult.metodo ?? "nenhum",
        inseridos: tramitaResult.inseridos,
        pulados: tramitaResult.pulados,
        erro: tramitaResult.erro,
      },
      dje_esaj: {
        estados_suportados: [
          "AL",
          "CE",
          "MS",
          "SP",
          "BA",
          "MA",
          "PA",
          "PB",
          "PE",
          "PI",
          "RN",
          "RO",
          "RR",
          "SE",
          "TO",
          "AP",
          "GO",
          "MT",
          "AM",
        ],
        nota: "Busca DJe por OAB incluída acima em por_oab.inseridos_dje",
      },
    },
    timestamp: new Date().toISOString(),
  });
}
