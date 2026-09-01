"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import {
  competenciaAtual,
  resolveTierAtingido,
  type MetasConfig,
  type BonusMetaStatus,
} from "./metas-bonus-types";

export type { MetasConfig, BonusMetaStatus } from "./metas-bonus-types";

export async function getBonusMetaStatus(
  colaboradorId: string,
  competencia?: string
): Promise<BonusMetaStatus | null> {
  const comp = competencia ?? competenciaAtual();

  const [colab] = await sql`
    SELECT meta1_valor, meta1_bonus, meta2_valor, meta2_bonus, meta3_valor, meta3_bonus
    FROM colaboradores
    WHERE id = ${colaboradorId}::uuid
  `;
  if (!colab) return null;

  const config: MetasConfig = {
    meta1_valor: colab.meta1_valor != null ? Number(colab.meta1_valor) : null,
    meta1_bonus: colab.meta1_bonus != null ? Number(colab.meta1_bonus) : null,
    meta2_valor: colab.meta2_valor != null ? Number(colab.meta2_valor) : null,
    meta2_bonus: colab.meta2_bonus != null ? Number(colab.meta2_bonus) : null,
    meta3_valor: colab.meta3_valor != null ? Number(colab.meta3_valor) : null,
    meta3_bonus: colab.meta3_bonus != null ? Number(colab.meta3_bonus) : null,
  };

  const [comissaoRow] = await sql`
    SELECT COALESCE(SUM(valor), 0) AS total
    FROM remuneracoes
    WHERE colaborador_id = ${colaboradorId}::uuid
      AND tipo = 'comissao'
      AND status = 'pago'
      AND to_char(competencia, 'YYYY-MM') = ${comp}
  `;
  const comissaoMes = Number(comissaoRow?.total ?? 0);

  const { tier, bonusValor, metaAtingidaValor, proximaMetaValor } =
    resolveTierAtingido(comissaoMes, config);

  const [jaGeradoRow] = await sql`
    SELECT 1 FROM remuneracoes
    WHERE colaborador_id = ${colaboradorId}::uuid
      AND origem_meta_competencia = ${`${comp}-01`}::date
  `;

  return {
    competencia: comp,
    comissaoMes,
    tierAtingido: tier,
    bonusValor,
    metaAtingidaValor,
    proximaMetaValor,
    faltaParaProxima:
      proximaMetaValor != null
        ? Math.max(0, proximaMetaValor - comissaoMes)
        : null,
    jaGerado: !!jaGeradoRow,
  };
}

/**
 * Gera a remuneração do bônus de meta do mês (tipo 'bonificacao'), pra ser
 * confirmada em Remunerações como qualquer outra. Ação manual — quem decide
 * quando "fechar o mês" é o admin, não um cron automático mexendo em
 * pagamento de verdade sem ninguém olhar.
 */
export async function gerarBonusMetaAction(
  colaboradorId: string,
  competencia?: string
): Promise<{ error?: string; valor?: number }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "colaboradores", "editar"))
    return { error: "Sem permissão." };

  const status = await getBonusMetaStatus(colaboradorId, competencia);
  if (!status) return { error: "Colaborador não encontrado." };
  if (status.tierAtingido === 0)
    return { error: "Nenhuma meta atingida neste mês." };
  if (status.jaGerado) return { error: "Bônus deste mês já foi gerado." };

  try {
    const [colab] =
      await sql`SELECT nome FROM colaboradores WHERE id = ${colaboradorId}::uuid`;
    await sql`
      INSERT INTO remuneracoes (
        colaborador_id, tipo, valor, competencia, status, descricao, origem_meta_competencia
      ) VALUES (
        ${colaboradorId}::uuid, 'bonificacao', ${status.bonusValor}::numeric,
        ${`${status.competencia}-01`}::date, 'pendente',
        ${`Bônus de meta ${status.competencia} — nível ${status.tierAtingido} cumulativo (${colab?.nome ?? ""})`},
        ${`${status.competencia}-01`}::date
      )
    `;
    revalidatePath("/dashboard/remuneracoes");
    revalidatePath(`/dashboard/colaboradores/${colaboradorId}`);
    return { valor: status.bonusValor };
  } catch (e) {
    console.error("[metas-bonus] falha ao gerar bônus:", e);
    return { error: "Erro ao gerar bônus." };
  }
}
