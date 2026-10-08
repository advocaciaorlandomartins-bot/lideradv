import type { DadoFaltante } from "./cerebroJuridico";

/**
 * Lógica pura (sem IA, sem DB) do "dado insuficiente" do Cérebro — extraída
 * de cerebroJuridico.ts pra poder ser testada direto (esse arquivo usa
 * "server-only" e não resolve fora do Next, o que até agora deixava essa
 * regra sem teste automatizado real, só revisão manual de código).
 *
 * Regra: 2+ dados de prioridade "alta" faltando é defesa em profundidade —
 * sobrepõe mesmo que o texto gerado pela IA tenha arriscado um percentual,
 * pra não dar uma probabilidade de êxito com base insuficiente de fatos.
 */
export function calcularProbabilidadeComFlag(
  faltantes: DadoFaltante[],
  probBruto: number | null
): { prob: number | null; probabilidadeInsuficiente: boolean } {
  const faltantesCriticos = faltantes.filter(
    (f) => f.prioridade === "alta"
  ).length;
  const probabilidadeInsuficiente = faltantesCriticos >= 2;
  return {
    prob: probabilidadeInsuficiente ? null : probBruto,
    probabilidadeInsuficiente,
  };
}
