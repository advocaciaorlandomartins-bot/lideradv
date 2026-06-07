"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sql from "./db";
import { logAction } from "./audit";
import { getSession } from "./session";

export type LancamentoFormState = { error: string } | null;

// Returns today's date as YYYY-MM-DD in the Brazil/Brasília timezone (UTC-3).
// Using CURRENT_DATE in PostgreSQL would return the UTC date, which can be
// one day ahead for users in Brazil after 21h local time.
function todayBR(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

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
  const paymentMode = (
    (formData.get("payment_mode") as string | null) ?? "avista"
  ).trim();
  const parcelado = paymentMode === "parcelado" || paymentMode === "retroativo";
  const recorrente = paymentMode === "recorrente";
  const mensalidade = paymentMode === "mensalidade";
  const valorEntradaStr = (
    (formData.get("valor_entrada") as string | null) ?? ""
  ).trim();
  const valorEntrada = valorEntradaStr ? parseFloat(valorEntradaStr) : 0;
  const totalParcelasStr = (
    (formData.get("total_parcelas") as string | null) ?? ""
  ).trim();
  const totalParcelas = totalParcelasStr ? parseInt(totalParcelasStr) : 1;
  const periodicidade = (
    (formData.get("periodicidade") as string | null) ?? "mensal"
  ).trim();
  const numRecorrenciasStr = (
    (formData.get("num_recorrencias") as string | null) ?? "12"
  ).trim();
  const numRecorrencias = parseInt(numRecorrenciasStr) || 12;
  const observacoes =
    ((formData.get("observacoes") as string | null) ?? "").trim() || null;
  const valorMensalidadeStr = (
    (formData.get("valor_mensalidade") as string | null) ?? ""
  ).trim();
  const valorMensalidade = valorMensalidadeStr
    ? parseFloat(valorMensalidadeStr)
    : 0;
  const indicadorId =
    ((formData.get("indicador_id") as string | null) ?? "").trim() || null;
  const comissaoTipo =
    ((formData.get("comissao_tipo") as string | null) ?? "").trim() || null;
  const comissaoValorConfigStr = (
    (formData.get("comissao_valor_config") as string | null) ?? ""
  ).trim();
  const comissaoValorConfig = comissaoValorConfigStr
    ? parseFloat(comissaoValorConfigStr)
    : null;

  if (!valorStr || isNaN(valor) || valor <= 0)
    return { error: "Informe um valor válido." };
  if (mensalidade && (isNaN(valorMensalidade) || valorMensalidade <= 0))
    return { error: "Informe o valor da mensalidade." };

  // Calculate commission if applicable
  const shouldCreateComissao =
    tipo === "entrada" &&
    indicadorId &&
    comissaoTipo &&
    comissaoValorConfig != null &&
    !isNaN(comissaoValorConfig) &&
    comissaoValorConfig > 0;

  const comissaoValorFinal = shouldCreateComissao
    ? comissaoTipo === "percentual"
      ? Math.round(valor * (comissaoValorConfig! / 100) * 100) / 100
      : comissaoValorConfig!
    : 0;

  const baseDateStr = dataVencimento || todayBR();

  try {
    let firstLancamentoId: string | null = null;
    // For parcelado: track each parcela ID so commission is split per installment
    const parcelaLancamentoIds: string[] = [];

    if (recorrente) {
      const grupoRecorrente = crypto.randomUUID();
      const baseDate = new Date(`${baseDateStr}T12:00:00`);
      for (let i = 0; i < numRecorrencias; i++) {
        const entryDate = new Date(baseDate);
        if (periodicidade === "semanal")
          entryDate.setDate(entryDate.getDate() + 7 * i);
        else if (periodicidade === "anual")
          entryDate.setFullYear(entryDate.getFullYear() + i);
        else entryDate.setMonth(entryDate.getMonth() + i);
        const entryDateStr = entryDate.toISOString().split("T")[0];
        const descEntry =
          i === 0 ? descricao : `${descricao} (${i + 1}/${numRecorrencias})`;
        const entryStatus = i === 0 ? status : "pendente";
        const rows = await sql`
          INSERT INTO lancamentos
            (tipo, categoria, descricao, valor, client_id, processo_id,
             status, data_vencimento, parcela_atual, total_parcelas,
             grupo_parcelas, observacoes)
          VALUES
            (${tipo}, ${categoria}, ${descEntry}, ${valor},
             ${clientId ? clientId : null}::uuid,
             ${processoId ? processoId : null}::uuid,
             ${entryStatus}, ${entryDateStr}::date,
             ${i + 1}, ${numRecorrencias},
             ${grupoRecorrente}::uuid, ${observacoes})
          RETURNING id
        `;
        if (i === 0) firstLancamentoId = rows[0].id as string;
      }
    } else if (mensalidade) {
      // Mensalidade fixa: N lancamentos de valor fixo = valorMensalidade cada
      const grupoParcelas = crypto.randomUUID();
      const numParcelas = Math.ceil(valor / valorMensalidade);
      const baseDate = new Date(`${baseDateStr}T12:00:00`);
      for (let i = 1; i <= numParcelas; i++) {
        const parcDate = new Date(baseDate);
        parcDate.setMonth(parcDate.getMonth() + i);
        const parcDateStr = parcDate.toISOString().split("T")[0];
        const descParcela = `${descricao} — Parcela ${i}/${numParcelas}`;
        const rows = await sql`
          INSERT INTO lancamentos
            (tipo, categoria, descricao, valor, client_id, processo_id,
             status, data_vencimento, parcela_atual, total_parcelas,
             grupo_parcelas, observacoes)
          VALUES
            (${tipo}, ${categoria}, ${descParcela}, ${valorMensalidade},
             ${clientId ? clientId : null}::uuid,
             ${processoId ? processoId : null}::uuid,
             'pendente', ${parcDateStr}::date, ${i}, ${numParcelas},
             ${grupoParcelas}::uuid, ${observacoes})
          RETURNING id
        `;
        if (!firstLancamentoId) firstLancamentoId = rows[0].id as string;
        parcelaLancamentoIds.push(rows[0].id as string);
      }
    } else if (!parcelado) {
      const dataVenc = dataVencimento || null;
      const rows = await sql`
        INSERT INTO lancamentos
          (tipo, categoria, descricao, valor, client_id, processo_id,
           status, data_vencimento, observacoes)
        VALUES
          (${tipo}, ${categoria}, ${descricao}, ${valor},
           ${clientId ? clientId : null}::uuid,
           ${processoId ? processoId : null}::uuid,
           ${status}, ${dataVenc ? dataVenc : null}::date, ${observacoes})
        RETURNING id
      `;
      firstLancamentoId = rows[0].id as string;
    } else {
      const grupoParcelas = crypto.randomUUID();
      const valorRestante = valor - valorEntrada;
      const valorParcela =
        totalParcelas > 0
          ? Math.round((valorRestante / totalParcelas) * 100) / 100
          : valorRestante;

      // Entrada (down payment) — not tracked for commission split
      if (valorEntrada > 0) {
        const descEntrada = `${descricao} — Entrada`;
        const rows = await sql`
          INSERT INTO lancamentos
            (tipo, categoria, descricao, valor, client_id, processo_id,
             status, data_vencimento, parcela_atual, total_parcelas,
             grupo_parcelas, observacoes)
          VALUES
            (${tipo}, ${categoria}, ${descEntrada}, ${valorEntrada},
             ${clientId ? clientId : null}::uuid,
             ${processoId ? processoId : null}::uuid,
             ${status}, ${baseDateStr}::date, 0, ${totalParcelas},
             ${grupoParcelas}::uuid, ${observacoes})
          RETURNING id
        `;
        firstLancamentoId = rows[0].id as string;
      }

      // Parcelas mensais
      const baseDate = new Date(`${baseDateStr}T12:00:00`);
      for (let i = 1; i <= totalParcelas; i++) {
        const parcDate = new Date(baseDate);
        parcDate.setMonth(parcDate.getMonth() + i);
        const parcDateStr = parcDate.toISOString().split("T")[0];
        const descParcela = `${descricao} — Parcela ${i}/${totalParcelas}`;
        const rows = await sql`
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
          RETURNING id
        `;
        if (!firstLancamentoId) firstLancamentoId = rows[0].id as string;
        parcelaLancamentoIds.push(rows[0].id as string);
      }
    }

    // Auto-create commission remuneração(ões) when applicable
    if (shouldCreateComissao && comissaoValorFinal > 0) {
      const descComissao = `Comissão — ${descricao}`;

      if ((parcelado || mensalidade) && parcelaLancamentoIds.length > 0) {
        // One commission remuneração per installment, linked to each lancamento
        const commPerParcela =
          Math.round((comissaoValorFinal / parcelaLancamentoIds.length) * 100) /
          100;
        for (let i = 0; i < parcelaLancamentoIds.length; i++) {
          const descParc =
            parcelaLancamentoIds.length > 1
              ? `${descComissao} (${i + 1}/${parcelaLancamentoIds.length})`
              : descComissao;
          const remRows = await sql`
            INSERT INTO remuneracoes
              (colaborador_id, tipo, valor, status, descricao, processo_id, client_id)
            VALUES
              (${indicadorId}::uuid, 'comissao', ${commPerParcela},
               'pendente', ${descParc},
               ${processoId ? processoId : null}::uuid,
               ${clientId ? clientId : null}::uuid)
            RETURNING id
          `;
          const remuneracaoId = remRows[0].id as string;
          await sql`
            UPDATE lancamentos SET remuneracao_id = ${remuneracaoId}::uuid
            WHERE id = ${parcelaLancamentoIds[i]}::uuid
          `;
        }
      } else if (firstLancamentoId) {
        // Single commission for avista / recorrente
        const remRows = await sql`
          INSERT INTO remuneracoes
            (colaborador_id, tipo, valor, status, descricao, processo_id, client_id)
          VALUES
            (${indicadorId}::uuid, 'comissao', ${comissaoValorFinal},
             'pendente', ${descComissao},
             ${processoId ? processoId : null}::uuid,
             ${clientId ? clientId : null}::uuid)
          RETURNING id
        `;
        const remuneracaoId = remRows[0].id as string;
        await sql`
          UPDATE lancamentos SET remuneracao_id = ${remuneracaoId}::uuid
          WHERE id = ${firstLancamentoId}::uuid
        `;
      }
    }
  } catch (err) {
    console.error("createLancamentoAction DB error:", err);
    return { error: "Erro ao salvar lançamento. Tente novamente." };
  }

  const valorFmt = valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  await logAction({
    acao: "criar",
    entidade: "lancamento",
    descricao: `Registrou ${tipo === "entrada" ? "receita" : "despesa"} de R$ ${valorFmt} — ${descricao}`,
    detalhes: { paymentMode, valor, tipo },
  });

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

  try {
    const current = await sql`
      SELECT status, remuneracao_id FROM lancamentos WHERE id = ${id}::uuid
    `;
    if (current.length === 0) return { error: "Lançamento não encontrado." };
    const oldStatus = current[0].status as string;
    const remuneracaoId = current[0].remuneracao_id as string | null;

    const hoje = todayBR();
    if (status === "pago" && oldStatus !== "pago") {
      await sql`
        UPDATE lancamentos SET
          tipo = ${tipo}, categoria = ${categoria}, descricao = ${descricao},
          valor = ${valor},
          client_id = ${clientId ? clientId : null}::uuid,
          processo_id = ${processoId ? processoId : null}::uuid,
          status = ${status}, data_vencimento = ${dataVencimento}::date,
          data_pagamento = ${hoje}::date, observacoes = ${observacoes}
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
            status = ${status}, data_pagamento = ${hoje}::date, updated_at = NOW()
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

  await logAction({
    acao: "editar",
    entidade: "lancamento",
    entidadeId: id,
    descricao: `Editou lançamento — ${descricao}`,
    detalhes: { valor, status },
  });

  redirect("/dashboard/financeiro");
}

export async function reagendarLancamentoAction(
  id: string,
  novaData: string
): Promise<void> {
  if (!novaData) return;
  try {
    await sql`
      UPDATE lancamentos
      SET data_vencimento = ${novaData}::date
      WHERE id = ${id}::uuid
    `;
  } catch (err) {
    console.error("reagendarLancamentoAction DB error:", err);
  }
  revalidatePath("/dashboard/financeiro");
}

export async function markAsPagoAction(id: string): Promise<void> {
  const session = await getSession();
  try {
    const rows = await sql`
      UPDATE lancamentos
      SET status = 'pago', data_pagamento = ${todayBR()}::date
      WHERE id = ${id}::uuid
      RETURNING remuneracao_id
    `;
    const remuneracaoId = rows[0]?.remuneracao_id as string | null;
    if (remuneracaoId) {
      await sql`
        UPDATE remuneracoes
        SET status = 'pago', data_pagamento = ${todayBR()}::date, updated_at = NOW()
        WHERE id = ${remuneracaoId}::uuid
      `;
    }
  } catch (err) {
    console.error("markAsPagoAction DB error:", err);
  }
  await logAction({
    acao: "pagar",
    entidade: "lancamento",
    entidadeId: id,
    descricao: "Marcou lançamento como pago",
    _login: session?.login ?? "sistema",
    _cat: session?.categoria ? String(session.categoria) : undefined,
  });
  revalidatePath("/dashboard/financeiro");
}

export async function deleteLancamentoAction(id: string): Promise<void> {
  const session = await getSession();
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
  await logAction({
    acao: "excluir",
    entidade: "lancamento",
    entidadeId: id,
    descricao: "Excluiu lançamento",
    _login: session?.login ?? "sistema",
    _cat: session?.categoria ? String(session.categoria) : undefined,
  });
  revalidatePath("/dashboard/financeiro");
}

export async function revertParaPendenteAction(id: string): Promise<void> {
  const session = await getSession();
  try {
    const rows = await sql`
      UPDATE lancamentos
      SET status = 'pendente', data_pagamento = NULL
      WHERE id = ${id}::uuid
      RETURNING remuneracao_id
    `;
    const remuneracaoId = rows[0]?.remuneracao_id as string | null;
    if (remuneracaoId) {
      await sql`
        UPDATE remuneracoes
        SET status = 'pendente', data_pagamento = NULL, updated_at = NOW()
        WHERE id = ${remuneracaoId}::uuid
      `;
    }
  } catch (err) {
    console.error("revertParaPendenteAction DB error:", err);
  }
  await logAction({
    acao: "reverter",
    entidade: "lancamento",
    entidadeId: id,
    descricao: "Reverteu lançamento para pendente",
    _login: session?.login ?? "sistema",
    _cat: session?.categoria ? String(session.categoria) : undefined,
  });
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
