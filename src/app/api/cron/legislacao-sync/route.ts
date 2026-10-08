/**
 * GET /api/cron/legislacao-sync
 * Confere o texto oficial (Planalto) das normas em escopo (LOAS/BPC idoso e
 * deficiência/autismo, salário-maternidade — ver src/lib/legislacao-sync.ts)
 * contra o que está salvo na Base Legal Viva. Nunca reescreve o texto
 * sozinho: só confirma (verificado_em) ou alerta (legislacao_sync_alertas +
 * WhatsApp) quando algo não bate mais, pra revisão humana.
 */
import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { sincronizarNormasEmEscopo } from "@/lib/legislacao-sync";
import { enviarMensagemDireta } from "@/lib/prevbot-outbound";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const resultados = await sincronizarNormasEmEscopo();
  const alterados = resultados.flatMap((r) =>
    r.alterados.map((caminho) => `${r.norma} ${caminho}`)
  );
  const erros = resultados.filter((r) => r.erro);

  await sql`
    INSERT INTO cron_execucoes (rota, processados, enviados, erros, detalhe)
    VALUES (
      '/api/cron/legislacao-sync',
      ${resultados.reduce((n, r) => n + r.checados, 0)},
      ${alterados.length},
      ${erros.length},
      ${JSON.stringify({ alterados, erros: erros.map((e) => `${e.norma}: ${e.erro}`) }).slice(0, 500)}
    )
  `.catch(() => null);

  // Mudança no texto de LOAS/autismo/salário-maternidade afeta toda análise
  // em andamento hoje — não espera o resumo diário das 8h, avisa na hora.
  if (alterados.length > 0) {
    const [cfg] = await sql`SELECT telefone FROM escritorio_config LIMIT 1`;
    const telefone = String(cfg?.telefone ?? "").trim();
    if (telefone) {
      await enviarMensagemDireta({
        telefone,
        mensagem:
          `⚠️ *Legislação pode ter mudado*\n\n` +
          `O texto oficial não bate mais com o que está salvo pra:\n` +
          alterados.map((a) => `• ${a}`).join("\n") +
          `\n\nIsso NÃO foi atualizado sozinho — confira manualmente no Planalto antes de confiar na análise do Cérebro pra esses pontos.`,
      }).catch(() => null);
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    resultados,
  });
}
