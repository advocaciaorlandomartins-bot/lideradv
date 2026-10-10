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
  // Confere o texto oficial de LOAS/autismo/salário-maternidade contra a
  // Base Legal Viva — escopo reduzido a pedido do Orlando (2026-10-08).
  "/api/cron/legislacao-sync",
  // Aprendizado do Cérebro Jurídico a partir de casos encerrados — antes só
  // rodava se alguém reabrisse o painel de um caso já concluído por acaso.
  "/api/cerebro/scheduler",
];

// Timeout do fetch pra cada sub-rota — precisa acompanhar o maxDuration que
// cada uma declara no próprio arquivo, senão o abort aqui corta a rota antes
// dela terminar. Achado em produção 2026-10-09: /api/cron/publicacoes
// declara maxDuration=120 mas o abort aqui era fixo em 55s pra TODAS as
// rotas — como publicações (DataJud + DJe-ESAJ por OAB + TramitaSign + DJEN,
// tudo sequencial) genuinamente passa de 55s, ela vinha sendo abortada
// TODO DIA havia pelo menos 15 dias seguidos, sempre com "TimeoutError" —
// zero publicação nova do TramitaSign chegava no sistema nesse intervalo
// inteiro, sem nenhum alerta (até o fix de "cron falhando" desta mesma
// sessão). Mantém 55s como default conservador pras rotas rápidas (falha
// cedo se alguma travar de verdade), e dá a folga real só pra quem declara
// precisar.
const TIMEOUT_MS_POR_ROTA: Record<string, number> = {
  "/api/cron/publicacoes": 110_000,
  "/api/cron/atualizacoes-legais": 110_000,
};
const TIMEOUT_MS_DEFAULT = 55_000;

/**
 * Base URL das chamadas internas.
 *
 * ATENÇÃO: antes isto era derivado do header `Host` da requisição. Como o
 * CRON_SECRET vai no header Authorization dessas chamadas, um `Host`
 * forjado fazia o servidor entregar o segredo a um host arbitrário (SSRF +
 * vazamento de credencial). Agora só usamos variáveis de ambiente do deploy.
 */
function baseUrlInterna(): string | null {
  const explicito = (
    process.env.APP_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    ""
  ).trim();
  if (explicito) return explicito.replace(/\/+$/, "");

  const vercel = (
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    ""
  ).trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;

  if (process.env.NODE_ENV !== "production") {
    return `http://localhost:${process.env.PORT ?? 3000}`;
  }
  return null;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const base = baseUrlInterna();
  if (!base) {
    return NextResponse.json(
      {
        error:
          "Base URL não configurada. Defina APP_BASE_URL (ou VERCEL_URL) no ambiente.",
      },
      { status: 503 }
    );
  }

  const authHeader: Record<string, string> = {
    Authorization: `Bearer ${secret}`,
  };

  const resultados: Record<string, unknown> = {};

  // Executa cada cron em sequência para não sobrecarregar o banco
  for (const path of CRONS) {
    let ok = false;
    let resultado: Record<string, unknown>;
    try {
      const res = await fetch(`${base}${path}`, {
        headers: authHeader,
        signal: AbortSignal.timeout(
          TIMEOUT_MS_POR_ROTA[path] ?? TIMEOUT_MS_DEFAULT
        ),
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
