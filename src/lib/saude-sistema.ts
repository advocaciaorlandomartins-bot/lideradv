import "server-only";
import sql from "./db";

export interface CronStatus {
  rota: string;
  ultimaExecucao: string | null;
  atrasado: boolean;
  falhando: boolean;
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
  { rota: "/api/cron/legislacao-sync", limiteHoras: 50 },
  { rota: "/api/cerebro/scheduler", limiteHoras: 50 },
];

/**
 * cron_execucoes já é gravada por lembretes/orquestrador a cada execução
 * (heartbeat), mas nada olhava pra essa tabela até agora — ficava só como
 * log passivo. Usada por verificar_saude (Íris) e pelo resumo diário.
 *
 * "falhando" (achado em auditoria de 2026-10-09): um cron que falha TODO
 * dia continuava gravando heartbeat com timestamp fresco — "atrasado"
 * nunca disparava, porque isso só olha se o cron RODOU, não se rodou com
 * sucesso. Um escritório que depende de /api/cron/publicacoes pra não
 * perder prazo processual não tinha como descobrir isso sem abrir
 * manualmente o status de cron. Marca "falhando" quando as últimas 3
 * execuções de uma rota tiveram erro — 1 falha isolada não dispara (pode
 * ser instabilidade pontual da API externa), falha recorrente dispara.
 */
export async function getCronsAtrasados(): Promise<CronStatus[]> {
  const rotas = CRONS_MONITORADOS.map((c) => c.rota);
  const rows = await sql`
    SELECT rota, MAX(executado_em) AS ultima,
           bool_and(erros > 0) FILTER (WHERE rn <= 3) AS falhando
    FROM (
      SELECT rota, executado_em, erros,
             ROW_NUMBER() OVER (PARTITION BY rota ORDER BY executado_em DESC) AS rn
      FROM cron_execucoes
      WHERE rota = ANY(${rotas}::text[])
    ) sub
    GROUP BY rota
  `;
  const map = new Map<string, { ultima: Date | null; falhando: boolean }>(
    rows.map((r) => [
      String(r.rota),
      {
        ultima: r.ultima ? new Date(r.ultima as string) : null,
        falhando: r.falhando === true,
      },
    ])
  );
  const agora = Date.now();
  return CRONS_MONITORADOS.map(({ rota, limiteHoras }) => {
    const info = map.get(rota) ?? { ultima: null, falhando: false };
    const atrasado =
      !info.ultima || agora - info.ultima.getTime() > limiteHoras * 3600_000;
    return {
      rota,
      ultimaExecucao: info.ultima ? info.ultima.toISOString() : null,
      atrasado,
      falhando: info.falhando,
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
