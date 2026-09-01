export interface MetasConfig {
  meta1_valor: number | null;
  meta1_bonus: number | null;
  meta2_valor: number | null;
  meta2_bonus: number | null;
  meta3_valor: number | null;
  meta3_bonus: number | null;
}

export interface BonusMetaStatus {
  competencia: string; // YYYY-MM
  comissaoMes: number;
  tierAtingido: 0 | 1 | 2 | 3;
  bonusValor: number;
  metaAtingidaValor: number | null;
  proximaMetaValor: number | null;
  faltaParaProxima: number | null;
  jaGerado: boolean;
}

/** Mês corrente no fuso de SP, formato YYYY-MM. */
export function competenciaAtual(): string {
  return new Date()
    .toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })
    .slice(0, 7);
}

/**
 * Degrau único: o bônus do mês é o da MAIOR meta batida, não a soma de
 * todas — bater a Meta 3 não empilha o bônus da 1 e da 2 por cima.
 */
export function resolveTierAtingido(
  comissaoMes: number,
  config: MetasConfig
): {
  tier: 0 | 1 | 2 | 3;
  bonusValor: number;
  metaAtingidaValor: number | null;
  proximaMetaValor: number | null;
} {
  const tiers: {
    tier: 1 | 2 | 3;
    valor: number | null;
    bonus: number | null;
  }[] = [
    { tier: 1, valor: config.meta1_valor, bonus: config.meta1_bonus },
    { tier: 2, valor: config.meta2_valor, bonus: config.meta2_bonus },
    { tier: 3, valor: config.meta3_valor, bonus: config.meta3_bonus },
  ];

  let melhor: {
    tier: 0 | 1 | 2 | 3;
    bonusValor: number;
    metaAtingidaValor: number | null;
  } = {
    tier: 0,
    bonusValor: 0,
    metaAtingidaValor: null,
  };
  let proximaMetaValor: number | null = null;

  for (const t of tiers) {
    if (t.valor == null || t.bonus == null) continue;
    if (comissaoMes >= t.valor) {
      melhor = {
        tier: t.tier,
        bonusValor: t.bonus,
        metaAtingidaValor: t.valor,
      };
    } else if (proximaMetaValor == null || t.valor < proximaMetaValor) {
      proximaMetaValor = t.valor;
    }
  }

  return { ...melhor, proximaMetaValor };
}
