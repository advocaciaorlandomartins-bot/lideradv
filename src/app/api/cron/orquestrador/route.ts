import { NextResponse } from "next/server";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRONS = [
  "/api/cron/publicacoes",
  "/api/cron/prevbot-retries",
  "/api/cron/prazos",
  "/api/cron/limpeza",
  "/api/cron/atualizacoes-legais",
  // Aprendizado do Cérebro Jurídico a partir de casos encerrados — antes só
  // rodava se alguém reabrisse o painel de um caso já concluído por acaso.
  "/api/cerebro/scheduler",
];

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Deriva a base URL a partir do header Host da requisição
  const host = req.headers.get("host") ?? "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const base = `${proto}://${host}`;

  const authHeader: Record<string, string> = secret
    ? { Authorization: `Bearer ${secret}` }
    : {};

  const resultados: Record<string, unknown> = {};

  // Executa cada cron em sequência para não sobrecarregar o banco
  for (const path of CRONS) {
    let ok = false;
    let resultado: Record<string, unknown>;
    try {
      const res = await fetch(`${base}${path}`, {
        headers: authHeader,
        signal: AbortSignal.timeout(55_000),
      });
      const body = await res.json().catch(() => ({ status: res.status }));
      ok = res.ok;
      resultado = { ok: res.ok, status: res.status, ...body };
    } catch (err) {
      resultado = { ok: false, error: String(err).slice(0, 200) };
    }
    resultados[path] = resultado;

    // Heartbeat — sem isso não dava pra saber, sem vasculhar logs da Vercel
    // (12h de retenção no plano Hobby), se um cron como publicações rodou
    // de verdade num dia específico. O corpo da resposta de cada sub-rota
    // fica salvo em "detalhe" pra dar contexto além do ok/erro.
    await sql`
      INSERT INTO cron_execucoes (rota, processados, enviados, erros, detalhe)
      VALUES (
        ${path}, 1, ${ok ? 1 : 0}, ${ok ? 0 : 1},
        ${JSON.stringify(resultado).slice(0, 500)}
      )
    `.catch(() => null);
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    resultados,
  });
}
