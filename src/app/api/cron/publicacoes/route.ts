import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { buscarPublicacoesPorOab } from "@/lib/datajud";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  // Autenticação do cron (Vercel define CRON_SECRET automaticamente)
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
  const resultados: { oab: string; estado: string; inseridos: number }[] = [];

  for (const row of rows) {
    const oab = {
      id: String(row.id),
      numero: String(row.numero),
      estado: String(row.estado),
      nome_advogado: row.nome_advogado ? String(row.nome_advogado) : null,
    };
    const inseridos = await buscarPublicacoesPorOab(oab, apiKey);
    totalInseridos += inseridos;
    resultados.push({ oab: oab.numero, estado: oab.estado, inseridos });
  }

  return NextResponse.json({
    ok: true,
    oabs_verificadas: rows.length,
    publicacoes_novas: totalInseridos,
    detalhes: resultados,
    timestamp: new Date().toISOString(),
  });
}
