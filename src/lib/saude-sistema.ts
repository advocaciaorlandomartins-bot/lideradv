import "server-only";
import sql from "./db";

export interface CronStatus {
  rota: string;
  ultimaExecucao: string | null;
  atrasado: boolean;
}

// lembretes roda todo dia (inclusive domingo) — 30h de folga é suficiente.
// Os demais só rodam via orquestrador (seg-sáb, 14h) — domingo sem execução
// é esperado, então o limite precisa cobrir o hiato normal de fim de semana
// (sábado 14h → segunda 14h = 48h) sem disparar alarme falso.
const CRONS_MONITORADOS: { rota: string; limiteHoras: number }[] = [
  { rota: "/api/cron/lembretes", limiteHoras: 30 },
  { rota: "/api/cron/publicacoes", limiteHoras: 50 },
  { rota: "/api/cron/prevbot-retries", limiteHoras: 50 },
  { rota: "/api/cron/prazos", limiteHoras: 50 },
  { rota: "/api/cron/limpeza", limiteHoras: 50 },
  { rota: "/api/cron/atualizacoes-legais", limiteHoras: 50 },
  { rota: "/api/cerebro/scheduler", limiteHoras: 50 },
];

/**
 * cron_execucoes já é gravada por lembretes/orquestrador a cada execução
 * (heartbeat), mas nada olhava pra essa tabela até agora — ficava só como
 * log passivo. Usada por verificar_saude (Íris) e pelo resumo diário.
 */
export async function getCronsAtrasados(): Promise<CronStatus[]> {
  const rotas = CRONS_MONITORADOS.map((c) => c.rota);
  const rows = await sql`
    SELECT rota, MAX(executado_em) AS ultima
    FROM cron_execucoes
    WHERE rota = ANY(${rotas}::text[])
    GROUP BY rota
  `;
  const map = new Map<string, Date | null>(
    rows.map((r) => [
      String(r.rota),
      r.ultima ? new Date(r.ultima as string) : null,
    ])
  );
  const agora = Date.now();
  return CRONS_MONITORADOS.map(({ rota, limiteHoras }) => {
    const ultima = map.get(rota) ?? null;
    const atrasado =
      !ultima || agora - ultima.getTime() > limiteHoras * 3600_000;
    return {
      rota,
      ultimaExecucao: ultima ? ultima.toISOString() : null,
      atrasado,
    };
  });
}

/**
 * Tentativas de login malsucedidas nas últimas N horas — a tabela já existe
 * e já é usada pro rate limit (src/lib/rate-limit.ts), mas nunca foi
 * exposta como sinal de possível força bruta.
 */
export async function getLoginFalhosRecentes(horas = 24): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM login_tentativas
    WHERE criado_em >= NOW() - (${horas} || ' hours')::interval
  `;
  return Number(rows[0]?.n ?? 0);
}
