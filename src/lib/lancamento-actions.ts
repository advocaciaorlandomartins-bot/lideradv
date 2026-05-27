"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sql from "./db";

export type LancamentoFormState = { error: string } | null;

export async function createLancamentoAction(
  _prev: LancamentoFormState,
  formData: FormData
): Promise<LancamentoFormState> {
  const tipo = ((formData.get("tipo") as string | null) ?? "entrada") as
    | "entrada"
    | "saida";
  const categoria =
    ((formData.get("categoria") as string | null) ?? "").trim() || null;
  const descricao =
    ((formData.get("descricao") as string | null) ?? "").trim() || "Lançamento";
  const valorStr = ((formData.get("valor") as string | null) ?? "").trim();
  const valor = parseFloat(valorStr);
  const clientId =
    ((formData.get("client_id") as string | null) ?? "").trim() || null;
  const processoId =
    ((formData.get("processo_id") as string | null) ?? "").trim() || null;
  const status = (
    (formData.get("status") as string | null) ?? "pendente"
  ).trim();
  const dataVencimento = (
    (formData.get("data_vencimento") as string | null) ?? ""
  ).trim();
  const parcelado = formData.get("parcelado") === "true";
  const valorEntradaStr = (
    (formData.get("valor_entrada") as string | null) ?? ""
  ).trim();
  const valorEntrada = valorEntradaStr ? parseFloat(valorEntradaStr) : 0;
  const totalParcelasStr = (
    (formData.get("total_parcelas") as string | null) ?? ""
  ).trim();
  const totalParcelas = totalParcelasStr ? parseInt(totalParcelasStr) : 1;
  const observacoes =
    ((formData.get("observacoes") as string | null) ?? "").trim() || null;

  if (!valorStr || isNaN(valor) || valor <= 0)
    return { error: "Informe um valor válido." };
  if (!dataVencimento) return { error: "Informe a data de vencimento." };

  try {
    if (!parcelado) {
      await sql`
        INSERT INTO lancamentos
          (tipo, categoria, descricao, valor, client_id, processo_id,
           status, data_vencimento, observacoes)
        VALUES
          (${tipo}, ${categoria}, ${descricao}, ${valor},
           ${clientId ? clientId : null}::uuid,
           ${processoId ? processoId : null}::uuid,
           ${status}, ${dataVencimento}::date, ${observacoes})
      `;
    } else {
      const grupoParcelas = crypto.randomUUID();
      const valorRestante = valor - valorEntrada;
      const valorParcela =
        totalParcelas > 0
          ? Math.round((valorRestante / totalParcelas) * 100) / 100
          : valorRestante;

      // Entrada (down payment)
      if (valorEntrada > 0) {
        const descEntrada = `${descricao} — Entrada`;
        await sql`
          INSERT INTO lancamentos
            (tipo, categoria, descricao, valor, client_id, processo_id,
             status, data_vencimento, parcela_atual, total_parcelas,
             grupo_parcelas, observacoes)
          VALUES
            (${tipo}, ${categoria}, ${descEntrada}, ${valorEntrada},
             ${clientId ? clientId : null}::uuid,
             ${processoId ? processoId : null}::uuid,
             ${status}, ${dataVencimento}::date, 0, ${totalParcelas},
             ${grupoParcelas}::uuid, ${observacoes})
        `;
      }

      // Parcelas mensais
      const baseDate = new Date(`${dataVencimento}T12:00:00`);
      for (let i = 1; i <= totalParcelas; i++) {
        const parcDate = new Date(baseDate);
        parcDate.setMonth(parcDate.getMonth() + i);
        const parcDateStr = parcDate.toISOString().split("T")[0];
        const descParcela = `${descricao} — Parcela ${i}/${totalParcelas}`;
        await sql`
          INSERT INTO lancamentos
            (tipo, categoria, descricao, valor, client_id, processo_id,
             status, data_vencimento, parcela_atual, total_parcelas,
             grupo_parcelas, observacoes)
          VALUES
            (${tipo}, ${categoria}, ${descParcela}, ${valorParcela},
             ${clientId ? clientId : null}::uuid,
             ${processoId ? processoId : null}::uuid,
             'pendente', ${parcDateStr}::date, ${i}, ${totalParcelas},
             ${grupoParcelas}::uuid, ${observacoes})
        `;
      }
    }
  } catch (err) {
    console.error("createLancamentoAction DB error:", err);
    return { error: "Erro ao salvar lançamento. Tente novamente." };
  }

  redirect("/dashboard/financeiro");
}

export async function updateLancamentoAction(
  id: string,
  _prev: LancamentoFormState,
  formData: FormData
): Promise<LancamentoFormState> {
  const tipo = ((formData.get("tipo") as string | null) ?? "entrada") as
    | "entrada"
    | "saida";
  const categoria =
    ((formData.get("categoria") as string | null) ?? "").trim() || null;
  const descricao =
    ((formData.get("descricao") as string | null) ?? "").trim() || "Lançamento";
  const valorStr = ((formData.get("valor") as string | null) ?? "").trim();
  const valor = parseFloat(valorStr);
  const clientId =
    ((formData.get("client_id") as string | null) ?? "").trim() || null;
  const processoId =
    ((formData.get("processo_id") as string | null) ?? "").trim() || null;
  const status = (
    (formData.get("status") as string | null) ?? "pendente"
  ).trim();
  const dataVencimento = (
    (formData.get("data_vencimento") as string | null) ?? ""
  ).trim();
  const observacoes =
    ((formData.get("observacoes") as string | null) ?? "").trim() || null;

  if (!valorStr || isNaN(valor) || valor <= 0)
    return { error: "Informe um valor válido." };
  if (!dataVencimento) return { error: "Informe a data de vencimento." };

  try {
    const current = await sql`
      SELECT status, remuneracao_id FROM lancamentos WHERE id = ${id}::uuid
    `;
    if (current.length === 0) return { error: "Lançamento não encontrado." };
    const oldStatus = current[0].status as string;
    const remuneracaoId = current[0].remuneracao_id as string | null;

    if (status === "pago" && oldStatus !== "pago") {
      await sql`
        UPDATE lancamentos SET
          tipo = ${tipo}, categoria = ${categoria}, descricao = ${descricao},
          valor = ${valor},
          client_id = ${clientId ? clientId : null}::uuid,
          processo_id = ${processoId ? processoId : null}::uuid,
          status = ${status}, data_vencimento = ${dataVencimento}::date,
          data_pagamento = CURRENT_DATE, observacoes = ${observacoes}
        WHERE id = ${id}::uuid
      `;
    } else if (status !== "pago") {
      await sql`
        UPDATE lancamentos SET
          tipo = ${tipo}, categoria = ${categoria}, descricao = ${descricao},
          valor = ${valor},
          client_id = ${clientId ? clientId : null}::uuid,
          processo_id = ${processoId ? processoId : null}::uuid,
          status = ${status}, data_vencimento = ${dataVencimento}::date,
          data_pagamento = NULL, observacoes = ${observacoes}
        WHERE id = ${id}::uuid
      `;
    } else {
      await sql`
        UPDATE lancamentos SET
          tipo = ${tipo}, categoria = ${categoria}, descricao = ${descricao},
          valor = ${valor},
          client_id = ${clientId ? clientId : null}::uuid,
          processo_id = ${processoId ? processoId : null}::uuid,
          status = ${status}, data_vencimento = ${dataVencimento}::date,
          observacoes = ${observacoes}
        WHERE id = ${id}::uuid
      `;
    }

    if (remuneracaoId && status !== oldStatus) {
      if (status === "pago") {
        await sql`
          UPDATE remuneracoes SET
            status = ${status}, data_pagamento = CURRENT_DATE, updated_at = NOW()
          WHERE id = ${remuneracaoId}::uuid
        `;
      } else {
        await sql`
          UPDATE remuneracoes SET
            status = ${status}, data_pagamento = NULL, updated_at = NOW()
          WHERE id = ${remuneracaoId}::uuid
        `;
      }
    }
  } catch (err) {
    console.error("updateLancamentoAction DB error:", err);
    return { error: "Erro ao atualizar lançamento. Tente novamente." };
  }

  redirect("/dashboard/financeiro");
}

export async function markAsPagoAction(id: string): Promise<void> {
  try {
    const rows = await sql`
      UPDATE lancamentos
      SET status = 'pago', data_pagamento = CURRENT_DATE
      WHERE id = ${id}::uuid
      RETURNING remuneracao_id
    `;
    const remuneracaoId = rows[0]?.remuneracao_id as string | null;
    if (remuneracaoId) {
      await sql`
        UPDATE remuneracoes
        SET status = 'pago', data_pagamento = CURRENT_DATE, updated_at = NOW()
        WHERE id = ${remuneracaoId}::uuid
      `;
    }
  } catch (err) {
    console.error("markAsPagoAction DB error:", err);
  }
  revalidatePath("/dashboard/financeiro");
}

export async function deleteLancamentoAction(id: string): Promise<void> {
  try {
    const rows = await sql`
      DELETE FROM lancamentos WHERE id = ${id}::uuid
      RETURNING remuneracao_id
    `;
    const remuneracaoId = rows[0]?.remuneracao_id as string | null;
    if (remuneracaoId) {
      // Deleting the remuneração would normally cascade back, but the lancamento
      // is already gone — so we just clean up the remuneração record directly.
      await sql`DELETE FROM remuneracoes WHERE id = ${remuneracaoId}::uuid`;
    }
  } catch (err) {
    console.error("deleteLancamentoAction DB error:", err);
  }
  revalidatePath("/dashboard/financeiro");
}

export async function deleteGrupoAction(grupoParcelas: string): Promise<void> {
  try {
    await sql`
      DELETE FROM lancamentos
      WHERE grupo_parcelas = ${grupoParcelas}::uuid
    `;
  } catch (err) {
    console.error("deleteGrupoAction DB error:", err);
  }
  revalidatePath("/dashboard/financeiro");
}
