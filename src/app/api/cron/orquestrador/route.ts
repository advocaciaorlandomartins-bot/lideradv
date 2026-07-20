import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRONS = [
  "/api/cron/publicacoes",
  "/api/cron/prevbot-retries",
  "/api/cron/prazos",
  "/api/cron/limpeza",
  "/api/cron/atualizacoes-legais",
];

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
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
    try {
      const res = await fetch(`${base}${path}`, {
        headers: authHeader,
        signal: AbortSignal.timeout(55_000),
      });
      const body = await res.json().catch(() => ({ status: res.status }));
      resultados[path] = { ok: res.ok, status: res.status, ...body };
    } catch (err) {
      resultados[path] = { ok: false, error: String(err).slice(0, 200) };
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    resultados,
  });
}
