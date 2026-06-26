import { NextResponse } from "next/server";
import sql from "@/lib/db";
import {
  buscarPublicacoesPorOab,
  buscarMovimentosPorProcesso,
} from "@/lib/datajud";
import { buscarPublicacoesDjeEsaj } from "@/lib/dje-esaj";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Autenticação do cron (Vercel define CRON_SECRET automaticamente)
  const auth = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Permite busca histórica via ?dias=N (padrão: 3 para o cron diário)
  const url = new URL(request.url);
  const diasParam = parseInt(url.searchParams.get("dias") ?? "3", 10);
  const diasAtras =
    Number.isFinite(diasParam) && diasParam > 0 && diasParam <= 180
      ? diasParam
      : 3;

  const apiKey = process.env.DATAJUD_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "DATAJUD_API_KEY não configurada. Cadastre-se em https://datajud-wiki.cnj.jus.br/ e adicione a chave no Vercel.",
        configurar: "npx vercel env add DATAJUD_API_KEY production",
      },
      { status: 503 }
    );
  }

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
    const inseridosDatajud = await buscarPublicacoesPorOab(
      oab,
      apiKey,
      diasAtras
    );
    const inseridosDje = await buscarPublicacoesDjeEsaj(oab, diasAtras);
    totalInseridos += inseridosDatajud + inseridosDje;
    resultados.push({
      oab: oab.numero,
      estado: oab.estado,
      inseridos_datajud: inseridosDatajud,
      inseridos_dje: inseridosDje,
    });
  }

  // Monitoramento por número de processo (funciona sem TramitaSign, para qualquer escritório)
  const processos = await sql`
    SELECT p.id::text, p.numero, c.name AS cliente_nome
    FROM processos p
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE p.numero IS NOT NULL AND p.numero != ''
      AND LENGTH(REGEXP_REPLACE(p.numero, '[^0-9]', '', 'g')) = 20
  `;

  let processoInseridos = 0;
  const processosResultados: { numero: string; inseridos: number }[] = [];

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

  // TramitaSign: recebe via webhook em /api/webhooks/tramitasign/publicacoes
  // (sessão web bloqueada por IP fora do Brasil — Vercel = EUA)

  return NextResponse.json({
    ok: true,
    oabs_verificadas: rows.length,
    publicacoes_novas: totalInseridos + processoInseridos,
    detalhes: {
      por_oab: resultados,
      por_processo: processosResultados,
      processos_monitorados: processos.length,
      tramitasign: {
        modo: "webhook",
        url: "https://lideradv.vercel.app/api/webhooks/tramitasign/publicacoes",
        nota: "Configure este webhook no painel do TramitaSign para receber publicações do TRF5 e demais tribunais",
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
