import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { _enviarWebhook } from "@/lib/prevbot-outbound";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const webhookKey =
    process.env.PREVBOT_WEBHOOK_KEY ?? process.env.PREVBOT_API_KEY;
  if (!webhookKey) {
    return NextResponse.json({
      ok: true,
      skipped: "PREVBOT_WEBHOOK_KEY não configurada",
    });
  }

  let enviados = 0;
  let falhos = 0;
  let processados = 0;

  try {
    const pendentes = await sql`
      SELECT id::text, payload, tentativas
      FROM prevbot_webhook_log
      WHERE status     = 'pendente'
        AND tentativas < 3
      ORDER BY created_at ASC
      LIMIT 20
    `;

    processados = pendentes.length;

    for (const row of pendentes) {
      const logId = String((row as { id: string }).id);
      const tentativas = Number((row as { tentativas: number }).tentativas);
      const payload = (row as { payload: Record<string, unknown> }).payload;

      const resultado = await _enviarWebhook(webhookKey, payload);
      const novasTentativas = tentativas + 1;

      if (resultado.ok) {
        await sql`
          UPDATE prevbot_webhook_log
          SET status = 'enviado', tentativas = ${novasTentativas}, enviado_em = NOW()
          WHERE id = ${logId}::uuid
        `;
        enviados++;
      } else {
        const novoStatus = novasTentativas >= 3 ? "falhou" : "pendente";
        await sql`
          UPDATE prevbot_webhook_log
          SET tentativas  = ${novasTentativas},
              status      = ${novoStatus},
              ultimo_erro = ${resultado.error ?? null}
          WHERE id = ${logId}::uuid
        `;
        falhos++;
        console.warn(
          `[prevbot-retries] Tentativa ${novasTentativas}/3 falhou (${logId}):`,
          resultado.error
        );
      }
    }
  } catch (err) {
    console.error("[prevbot-retries] Erro:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    processados,
    enviados,
    falhos,
  });
}
