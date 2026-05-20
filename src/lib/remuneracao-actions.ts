"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sql from "./db";

export type RemuneracaoFormState = { error: string } | null;

const TIPO_LABEL: Record<string, string> = {
  salario: "Salário",
  comissao: "Comissão",
  bonificacao: "Bonificação",
};

function getFields(formData: FormData) {
  const competenciaRaw = (formData.get("competencia") as string | null) || null;
  return {
    colaboradorId: (
      (formData.get("colaborador_id") as string | null) ?? ""
    ).trim(),
    tipo: ((formData.get("tipo") as string | null) ?? "").trim(),
    valor: ((formData.get("valor") as string | null) ?? "").trim(),
    competencia: competenciaRaw ? `${competenciaRaw}-01` : null,
    dataPagamento: (formData.get("data_pagamento") as string | null) || null,
    status: ((formData.get("status") as string | null) ?? "pendente").trim(),
    descricao:
      ((formData.get("descricao") as string | null) ?? "").trim() || null,
    processoId:
      ((formData.get("processo_id") as string | null) ?? "").trim() || null,
  };
}

export async function createRemuneracaoAction(
  _prev: RemuneracaoFormState,
  formData: FormData
): Promise<RemuneracaoFormState> {
  const f = getFields(formData);

  if (!f.colaboradorId) return { error: "Selecione o colaborador." };
  if (!f.tipo) return { error: "Selecione o tipo de remuneração." };
  if (!f.valor || isNaN(Number(f.valor)) || Number(f.valor) <= 0)
    return { error: "Informe um valor válido." };

  try {
    // Get colaborador name for lancamento description
    const colabRows = await sql`
      SELECT nome FROM colaboradores WHERE id = ${f.colaboradorId}::uuid
    `;
    if (colabRows.length === 0) return { error: "Colaborador não encontrado." };
    const colaboradorNome = colabRows[0].nome as string;

    // Insert remuneração and get its id
    const remRows = await sql`
      INSERT INTO remuneracoes (
        colaborador_id, tipo, valor,
        competencia, data_pagamento, status, descricao, processo_id
      ) VALUES (
        ${f.colaboradorId}::uuid,
        ${f.tipo},
        ${f.valor}::numeric,
        ${f.competencia ? f.competencia : null}::date,
        ${f.dataPagamento ? f.dataPagamento : null}::date,
        ${f.status},
        ${f.descricao},
        ${f.processoId ? f.processoId : null}::uuid
      )
      RETURNING id
    `;
    const remuneracaoId = remRows[0].id as string;

    // Build lancamento description
    const tipoLabel = TIPO_LABEL[f.tipo] ?? f.tipo;
    const descBase = `${tipoLabel} — ${colaboradorNome}`;
    const descFull = f.descricao ? `${descBase} (${f.descricao})` : descBase;

    // data_vencimento: pagamento date > competência > today
    const dataVenc =
      f.dataPagamento ??
      f.competencia ??
      new Date().toISOString().split("T")[0];

    // Mirror as saída in lancamentos
    await sql`
      INSERT INTO lancamentos (tipo, categoria, descricao, valor, status, data_vencimento, remuneracao_id)
      VALUES (
        'saida',
        'Pessoal',
        ${descFull},
        ${f.valor}::numeric,
        ${f.status},
        ${dataVenc}::date,
        ${remuneracaoId}::uuid
      )
    `;
  } catch (err) {
    console.error("createRemuneracaoAction DB error:", err);
    return { error: "Erro ao salvar remuneração. Tente novamente." };
  }

  redirect("/dashboard/financeiro?tab=remuneracoes");
}

export async function markRemuneracaoPagaAction(id: string): Promise<void> {
  try {
    await sql`
      UPDATE remuneracoes
      SET status = 'pago', data_pagamento = CURRENT_DATE, updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
    // Sync linked lancamento
    await sql`
      UPDATE lancamentos
      SET status = 'pago', data_pagamento = CURRENT_DATE
      WHERE remuneracao_id = ${id}::uuid
    `;
  } catch (err) {
    console.error("markRemuneracaoPagaAction DB error:", err);
  }
  revalidatePath("/dashboard/financeiro");
}

export async function deleteRemuneracaoAction(id: string): Promise<void> {
  try {
    // ON DELETE CASCADE automatically removes the linked lancamento
    await sql`DELETE FROM remuneracoes WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("deleteRemuneracaoAction DB error:", err);
  }
  revalidatePath("/dashboard/financeiro");
}
