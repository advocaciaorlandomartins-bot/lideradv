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
 * Cumulativo: cada meta batida SOMA seu bônus ao total — bater a Meta 2 paga
 * o bônus da Meta 1 + o incremento da Meta 2 (ex.: R$500 + R$300 = R$800);
 * bater a Meta 3 soma os três (R$500+R$300+R$200 = R$1.000). Cada
 * "metaN_bonus" cadastrado já é o INCREMENTO daquele degrau, não o total —
 * mesmo modelo do documento de referência ("Metas e bônus fixos
 * (cumulativos, independentes da comissão sobre excedente)").
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

  let tierAtingido: 0 | 1 | 2 | 3 = 0;
  let bonusTotal = 0;
  let metaAtingidaValor: number | null = null;
  let proximaMetaValor: number | null = null;

  for (const t of tiers) {
    if (t.valor == null || t.bonus == null) continue;
    if (comissaoMes >= t.valor) {
      tierAtingido = t.tier;
      bonusTotal += t.bonus;
      metaAtingidaValor = t.valor;
    } else if (proximaMetaValor == null || t.valor < proximaMetaValor) {
      proximaMetaValor = t.valor;
    }
  }

  return {
    tier: tierAtingido,
    bonusValor: bonusTotal,
    metaAtingidaValor,
    proximaMetaValor,
  };
}
