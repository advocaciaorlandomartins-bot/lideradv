import { NextResponse } from "next/server";
import sql from "@/lib/db";
import {
  buscarPublicacoesPorOab,
  buscarMovimentosPorProcesso,
} from "@/lib/datajud";
import { buscarPublicacoesDjeEsaj } from "@/lib/dje-esaj";
import { sincronizarTramitaSign } from "@/lib/tramitasign-sync";
import { enviarEmailNovaPublicacao } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  // Autenticação do cron (Vercel define CRON_SECRET automaticamente)
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Permite busca histórica via ?dias=N (padrão: 3 para o cron diário)
  const url = new URL(request.url);
  const diasParam = parseInt(url.searchParams.get("dias") ?? "3", 10);
  const diasAtras =
    Number.isFinite(diasParam) && diasParam > 0 && diasParam <= 180
      ? diasParam
      : 3;

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

  // Monitoramento por número de processo via DataJud (requer DATAJUD_API_KEY)
  const processos = apiKey
    ? await sql`
        SELECT p.id::text, p.numero, c.name AS cliente_nome
        FROM processos p
        LEFT JOIN clients c ON c.id = p.client_id
        WHERE p.numero IS NOT NULL AND p.numero != ''
          AND LENGTH(REGEXP_REPLACE(p.numero, '[^0-9]', '', 'g')) = 20
      `
    : [];

  let processoInseridos = 0;
  const processosResultados: { numero: string; inseridos: number }[] = [];

  if (apiKey) {
    for (const proc of processos) {
      const inseridos = await buscarMovimentosPorProcesso(
        String(proc.id),
        String(proc.numero),
        proc.cliente_nome ? String(proc.cliente_nome) : null,
        apiKey,
        diasAtras
      );
      processoInseridos += inseridos;
      if (inseridos > 0)
        processosResultados.push({ numero: String(proc.numero), inseridos });
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

  const totalNovas =
    totalInseridos + processoInseridos + tramitaResult.inseridos;

  // Envia email de resumo se o cron encontrou publicações novas
  if (totalNovas > 0) {
    try {
      const configRows = await sql`SELECT email FROM escritorio_config LIMIT 1`;
      const emailDestino = (
        (configRows[0] as { email?: string } | undefined)?.email ?? ""
      ).trim();
      if (emailDestino) {
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
        if (recentes.length > 0) {
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
      }
    } catch (err) {
      console.error("[cron/publicacoes] erro ao enviar email:", err);
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
