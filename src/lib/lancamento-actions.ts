"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sql from "./db";
import { logAction } from "./audit";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { notificarPrevBot } from "./prevbot-outbound";
import {
  agendarLembretesHonorario,
  cancelarLembretesLancamento,
  agendarConfirmacaoPagamento,
} from "./lembretes";
import { gerarComissaoAutomaticaPorPagamento } from "./comissao-colaborador";

export type LancamentoFormState = { error: string } | null;

// Cancela os lembretes de cobrança já agendados pro lançamento e — se ele
// ainda estiver ativo (pendente, com data real) — agenda de novo com o
// valor/data atuais. Sem isso, editar o valor ou a data de um lançamento
// deixava os lembretes antigos com o valor/data ERRADOS ainda na fila pra
// enviar ao cliente; excluir/cancelar deixava o lembrete antigo sendo
// enviado para uma cobrança que não existe mais.
async function reagendarLembretesHonorarioLancamento(
  lancamentoId: string,
  clientId: string | null,
  valor: number,
  dataVencimentoISO: string,
  descricao: string
): Promise<void> {
  await cancelarLembretesLancamento(lancamentoId).catch(() => null);
  if (!clientId) return;
  try {
    const clienteRows = await sql`
      SELECT name, phone, menor_incapaz, responsavel_nome, responsavel_telefone
      FROM clients WHERE id = ${clientId}::uuid LIMIT 1
    `;
    if (clienteRows.length === 0) return;
    if (!clienteRows[0].phone && !clienteRows[0].responsavel_telefone) return;

    const clienteNome = String(clienteRows[0].name);
    const telefone = clienteRows[0].phone ? String(clienteRows[0].phone) : null;
    const responsavel =
      clienteRows[0].menor_incapaz &&
      clienteRows[0].responsavel_nome &&
      clienteRows[0].responsavel_telefone
        ? {
            nome: String(clienteRows[0].responsavel_nome),
            telefone: String(clienteRows[0].responsavel_telefone),
          }
        : null;

    await agendarLembretesHonorario({
      lancamentoId,
      clienteId: clientId,
      clienteNome,
      telefone,
      responsavel,
      valor,
      dataVencimento: new Date(`${dataVencimentoISO}T12:00:00`),
      descricao,
    });
  } catch {
    // lembretes são não-críticos, não falha a operação principal
  }
}

// Returns today's date as YYYY-MM-DD in the Brazil/Brasília timezone (UTC-3).
// Using CURRENT_DATE in PostgreSQL would return the UTC date, which can be
// one day ahead for users in Brazil after 21h local time.
function todayBR(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

// Soma `meses` a uma data YYYY-MM-DD sem o "estouro" de Date.setMonth().
// Date.setMonth() em 31/01 + 1 mês devolve 03/03 (fevereiro não tem dia 31),
// o que fazia a cobrança de qualquer cliente com vencimento em 29/30/31
// pular um mês inteiro. Aqui o dia é limitado ao último dia do mês destino.
function addMonthsISO(baseISO: string, meses: number): string {
  const [y, m, d] = baseISO.split("-").map(Number);
  const alvoMes = m - 1 + meses;
  const anoAlvo = y + Math.floor(alvoMes / 12);
  const mesAlvo = ((alvoMes % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(anoAlvo, mesAlvo + 1, 0)).getUTCDate();
  const dia = Math.min(d, ultimoDia);
  return `${anoAlvo}-${String(mesAlvo + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export async function createLancamentoAction(
  _prev: LancamentoFormState,
  formData: FormData
): Promise<LancamentoFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "financeiro", "criar"))
    return { error: "Sem permissão." };

  const tipo = ((formData.get("tipo") as string | null) ?? "entrada") as
    | "entrada"
    | "saida";
  const categoria =
    ((formData.get("categoria") as string | null) ?? "").trim() || null;
  const descricao =
    ((formData.get("descricao") as string | null) ?? "").trim() || "Lançamento";
  const valorStr = ((formData.get("valor") as string | null) ?? "").trim();
  const valor = valorStr ? parseFloat(valorStr) : 0;
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
  const cancelAguardando =
    ((formData.get("cancel_aguardando") as string | null) ?? "").trim() || null;
  const valorMensalidadeStr = (
    (formData.get("valor_mensalidade") as string | null) ?? ""
  ).trim();
  const valorMensalidade = valorMensalidadeStr
    ? parseFloat(valorMensalidadeStr)
    : 0;
  const comissaoModoPagamento = (
    (formData.get("comissao_modo_pagamento") as string | null) ?? "auto"
  ).trim();
  const comissaoValorCustomStr = (
    (formData.get("comissao_valor_custom") as string | null) ?? ""
  ).trim();
  const comissaoValorCustom = comissaoValorCustomStr
    ? parseFloat(comissaoValorCustomStr)
    : null;

  if (!valorStr || isNaN(valor) || valor <= 0)
    return { error: "Informe um valor válido." };

  // ── Caminho especial: aguardando resultado ────────────────────────────────
  // Ignora modo de pagamento e cria sempre uma entrada única com data sentinela.
  if (status === "aguardando_resultado") {
    try {
      await sql`
        INSERT INTO lancamentos
          (tipo, categoria, descricao, valor, client_id, processo_id,
           status, data_vencimento, observacoes)
        VALUES
          (${tipo}, ${categoria}, ${descricao}, ${valor},
           ${clientId ? clientId : null}::uuid,
           ${processoId ? processoId : null}::uuid,
           'aguardando_resultado', '9999-12-31'::date, ${observacoes})
      `;
    } catch (err) {
      console.error("createLancamentoAction aguardando error:", err);
      return { error: "Erro ao salvar lançamento. Tente novamente." };
    }
    const rawRedirect = (
      (formData.get("redirect_to") as string | null) ?? ""
    ).trim();
    const redirectTo = rawRedirect.startsWith("/")
      ? rawRedirect
      : "/dashboard/financeiro";
    await logAction({
      acao: "criar",
      entidade: "lancamento",
      descricao: `Criou lançamento aguardando resultado: ${descricao} (${tipo})`,
    });
    revalidatePath("/dashboard/financeiro");
    redirect(redirectTo);
  }

  // Config de comissão do indicador vem sempre do cadastro do cliente, nunca
  // do formulário — os campos indicador_id/comissao_tipo/comissao_valor_config
  // no form são só hidden inputs de exibição; se fossem aceitos como vieram,
  // qualquer um com permissão de criar lançamento poderia adulterar o valor
  // pago ao indicador (ex: via devtools) e desviar dinheiro do escritório.
  let indicadorId: string | null = null;
  let comissaoTipo: string | null = null;
  let comissaoValorConfig: number | null = null;
  if (clientId) {
    const [clienteComissao] = await sql`
      SELECT indicador_id::text, comissao_tipo, comissao_valor
      FROM clients WHERE id = ${clientId}::uuid LIMIT 1
    `.catch(() => []);
    if (clienteComissao) {
      indicadorId = (clienteComissao.indicador_id as string | null) ?? null;
      comissaoTipo = (clienteComissao.comissao_tipo as string | null) ?? null;
      comissaoValorConfig =
        clienteComissao.comissao_valor != null
          ? Number(clienteComissao.comissao_valor)
          : null;
    }
  }

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
    let entradaLancamentoId: string | null = null;
    // For parcelado: track each parcela ID so commission is split per installment
    const parcelaLancamentoIds: string[] = [];
    // Valor real gravado em cada parcela (a última absorve os centavos
    // restantes) — usado depois pro lembrete de cobrança não divergir do
    // valor de verdade da parcela.
    const parcelaValores: number[] = [];

    if (recorrente) {
      const grupoRecorrente = crypto.randomUUID();
      for (let i = 0; i < numRecorrencias; i++) {
        let entryDateStr: string;
        if (periodicidade === "semanal") {
          const d = new Date(`${baseDateStr}T12:00:00`);
          d.setDate(d.getDate() + 7 * i);
          entryDateStr = d.toISOString().split("T")[0];
        } else if (periodicidade === "anual") {
          entryDateStr = addMonthsISO(baseDateStr, 12 * i);
        } else {
          entryDateStr = addMonthsISO(baseDateStr, i);
        }
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
      // Mensalidade fixa: entrada opcional + N parcelas de valorMensalidade cada
      const grupoParcelas = crypto.randomUUID();
      const valorParcelar =
        valorEntrada > 0 ? Math.max(valor - valorEntrada, 0) : valor;
      const numParcelas =
        valorParcelar > 0 && valorMensalidade > 0
          ? Math.max(1, Math.floor(valorParcelar / valorMensalidade))
          : valorParcelar > 0
            ? 1
            : 0;

      if (valorEntrada > 0) {
        const descEntrada = `${descricao} — Entrada`;
        const rowsEnt = await sql`
          INSERT INTO lancamentos
            (tipo, categoria, descricao, valor, client_id, processo_id,
             status, data_vencimento, parcela_atual, total_parcelas,
             grupo_parcelas, observacoes)
          VALUES
            (${tipo}, ${categoria}, ${descEntrada}, ${valorEntrada},
             ${clientId ? clientId : null}::uuid,
             ${processoId ? processoId : null}::uuid,
             ${status}, ${baseDateStr}::date, 0, ${numParcelas},
             ${grupoParcelas}::uuid, ${observacoes})
          RETURNING id
        `;
        firstLancamentoId = rowsEnt[0].id as string;
        entradaLancamentoId = rowsEnt[0].id as string;
      }

      for (let i = 1; i <= numParcelas; i++) {
        const parcDateStr = addMonthsISO(
          baseDateStr,
          valorEntrada > 0 ? i : i - 1
        );
        const descParcela = `${descricao} — Parcela ${i}/${numParcelas}`;
        // Última parcela absorve os centavos restantes para o total fechar exato
        const valorParcela =
          i === numParcelas
            ? Math.round(
                (valorParcelar - (numParcelas - 1) * valorMensalidade) * 100
              ) / 100
            : valorMensalidade;
        const rows = await sql`
          INSERT INTO lancamentos
            (tipo, categoria, descricao, valor, client_id, processo_id,
             status, data_vencimento, parcela_atual, total_parcelas,
             grupo_parcelas, observacoes)
          VALUES
            (${tipo}, ${categoria}, ${descParcela}, ${valorParcela},
             ${clientId ? clientId : null}::uuid,
             ${processoId ? processoId : null}::uuid,
             'pendente', ${parcDateStr}::date, ${i}, ${numParcelas},
             ${grupoParcelas}::uuid, ${observacoes})
          RETURNING id
        `;
        if (!firstLancamentoId) firstLancamentoId = rows[0].id as string;
        parcelaLancamentoIds.push(rows[0].id as string);
        parcelaValores.push(valorParcela);
      }
    } else if (!parcelado) {
      // aguardando_resultado: usa data sentinela 9999-12-31 (data real será definida quando sair o resultado)
      const dataVenc =
        status === "aguardando_resultado"
          ? "9999-12-31"
          : dataVencimento || todayBR();
      const rows = await sql`
        INSERT INTO lancamentos
          (tipo, categoria, descricao, valor, client_id, processo_id,
           status, data_vencimento, observacoes)
        VALUES
          (${tipo}, ${categoria}, ${descricao}, ${valor},
           ${clientId ? clientId : null}::uuid,
           ${processoId ? processoId : null}::uuid,
           ${status}, ${dataVenc}::date, ${observacoes})
        RETURNING id
      `;
      firstLancamentoId = rows[0].id as string;
    } else {
      const grupoParcelas = crypto.randomUUID();
      const valorRestante = valor - valorEntrada;
      const valorParcelaBase =
        totalParcelas > 0
          ? Math.round((valorRestante / totalParcelas) * 100) / 100
          : valorRestante;

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
        entradaLancamentoId = rows[0].id as string;
      }

      // Parcelas mensais — última parcela absorve centavos para o total fechar exato
      for (let i = 1; i <= totalParcelas; i++) {
        const parcDateStr = addMonthsISO(
          baseDateStr,
          valorEntrada > 0 ? i : i - 1
        );
        const descParcela = `${descricao} — Parcela ${i}/${totalParcelas}`;
        const valorParcela =
          i === totalParcelas
            ? Math.round(
                (valorRestante - (totalParcelas - 1) * valorParcelaBase) * 100
              ) / 100
            : valorParcelaBase;
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
        parcelaValores.push(valorParcela);
      }
    }

    // Cancela o lançamento "aguardando resultado" que deu origem a este
    const UUID_RE_CA =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (cancelAguardando && UUID_RE_CA.test(cancelAguardando)) {
      await sql`
        DELETE FROM lancamentos
        WHERE id = ${cancelAguardando}::uuid
          AND status = 'aguardando_resultado'
          AND client_id IS NOT DISTINCT FROM ${clientId ? clientId : null}::uuid
      `;
    }

    // Auto-create commission remuneração(ões) when applicable
    if (shouldCreateComissao && comissaoValorFinal > 0) {
      const descComissao = `Comissão — ${descricao}`;
      const comissaoAvista = comissaoModoPagamento === "avista";
      // When paying à vista with a negotiated value, use it; otherwise fall back to calculated
      const comissaoValorAvista =
        comissaoAvista && comissaoValorCustom && comissaoValorCustom > 0
          ? comissaoValorCustom
          : comissaoValorFinal;

      if (
        (parcelado || mensalidade) &&
        parcelaLancamentoIds.length > 0 &&
        !comissaoAvista
      ) {
        const calcComm = (componentValue: number) =>
          comissaoTipo === "percentual"
            ? Math.round(componentValue * (comissaoValorConfig! / 100) * 100) /
              100
            : valor > 0
              ? Math.round(
                  comissaoValorFinal * (componentValue / valor) * 100
                ) / 100
              : 0;

        // Commission on entrada, linked to its lancamento
        if (entradaLancamentoId && valorEntrada > 0) {
          const commEntrada = calcComm(valorEntrada);
          if (commEntrada > 0) {
            const descEnt = `${descComissao} — Entrada`;
            const remRowsEnt = await sql`
              INSERT INTO remuneracoes
                (colaborador_id, tipo, valor, status, descricao, processo_id, client_id)
              VALUES
                (${indicadorId}::uuid, 'comissao', ${commEntrada},
                 'pendente', ${descEnt},
                 ${processoId ? processoId : null}::uuid,
                 ${clientId ? clientId : null}::uuid)
              RETURNING id
            `;
            const remIdEnt = remRowsEnt[0].id as string;
            await sql`
              UPDATE lancamentos SET remuneracao_id = ${remIdEnt}::uuid
              WHERE id = ${entradaLancamentoId}::uuid
            `;
          }
        }

        // Commission per parcela — calculada a partir do valor REAL de cada
        // parcela (parcelaValores[i], que já inclui o ajuste de centavos da
        // última parcela), não de um valor médio recalculado à parte. Antes,
        // usar o mesmo valor médio pra todas fazia a soma das comissões
        // fechar alguns centavos abaixo do valor configurado.
        for (let i = 0; i < parcelaLancamentoIds.length; i++) {
          const commParcela = calcComm(parcelaValores[i] ?? 0);
          if (commParcela <= 0) continue;
          const descParc =
            parcelaLancamentoIds.length > 1
              ? `${descComissao} (${i + 1}/${parcelaLancamentoIds.length})`
              : descComissao;
          const remRows = await sql`
              INSERT INTO remuneracoes
                (colaborador_id, tipo, valor, status, descricao, processo_id, client_id)
              VALUES
                (${indicadorId}::uuid, 'comissao', ${commParcela},
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
        // Single à vista commission (all non-parcelado modes, or when user chose à vista)
        const valorParaUsar = comissaoAvista
          ? comissaoValorAvista
          : comissaoValorFinal;
        const remRows = await sql`
          INSERT INTO remuneracoes
            (colaborador_id, tipo, valor, status, descricao, processo_id, client_id)
          VALUES
            (${indicadorId}::uuid, 'comissao', ${valorParaUsar},
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

    // Agenda lembretes de cobrança para entradas pendentes com cliente
    if (tipo === "entrada" && clientId && status === "pendente") {
      try {
        const clienteRows = await sql`
          SELECT name, phone, menor_incapaz, responsavel_nome, responsavel_telefone
          FROM clients WHERE id = ${clientId}::uuid LIMIT 1
        `;
        if (
          clienteRows.length > 0 &&
          (clienteRows[0].phone || clienteRows[0].responsavel_telefone)
        ) {
          const clienteNome = String(clienteRows[0].name);
          const telefone = clienteRows[0].phone
            ? String(clienteRows[0].phone)
            : null;
          // Responsável legal só tem prioridade quando o cliente é
          // efetivamente menor/incapaz — clientes adultos com contato de
          // emergência cadastrado continuam recebendo no próprio telefone.
          const responsavel =
            clienteRows[0].menor_incapaz &&
            clienteRows[0].responsavel_nome &&
            clienteRows[0].responsavel_telefone
              ? {
                  nome: String(clienteRows[0].responsavel_nome),
                  telefone: String(clienteRows[0].responsavel_telefone),
                }
              : null;

          const toSchedule: Array<{
            id: string;
            dataStr: string;
            val: number;
          }> = [];

          if (entradaLancamentoId && valorEntrada > 0) {
            toSchedule.push({
              id: entradaLancamentoId,
              dataStr: baseDateStr,
              val: valorEntrada,
            });
          }

          if (parcelaLancamentoIds.length > 0) {
            // Usa o valor real de cada parcela (parcelaValores[i], já com o
            // ajuste de centavos da última) em vez de recalcular uma média —
            // senão a mensagem de cobrança da última parcela podia informar
            // um valor diferente do que está de fato gravado/cobrado.
            for (let i = 0; i < parcelaLancamentoIds.length; i++) {
              const parcDateStr = addMonthsISO(
                baseDateStr,
                entradaLancamentoId ? i + 1 : i
              );
              toSchedule.push({
                id: parcelaLancamentoIds[i],
                dataStr: parcDateStr,
                val: parcelaValores[i] ?? 0,
              });
            }
          } else if (firstLancamentoId && !recorrente) {
            toSchedule.push({
              id: firstLancamentoId,
              dataStr: baseDateStr,
              val: valor,
            });
          }

          for (const item of toSchedule) {
            await agendarLembretesHonorario({
              lancamentoId: item.id,
              clienteId: clientId,
              clienteNome,
              telefone,
              responsavel,
              valor: item.val,
              dataVencimento: new Date(`${item.dataStr}T12:00:00`),
              descricao,
            }).catch(() => null);
          }
        }
      } catch {
        // lembretes são não-críticos, não falha o lançamento
      }
    }
  } catch (err) {
    console.error("createLancamentoAction DB error:", err);
    return { error: "Erro ao salvar lançamento. Tente novamente." };
  }

  const rawRedirect = (
    (formData.get("redirect_to") as string | null) ?? ""
  ).trim();
  const redirectTo = rawRedirect.startsWith("/")
    ? rawRedirect
    : "/dashboard/financeiro";

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

  redirect(redirectTo);
}

export async function updateLancamentoAction(
  id: string,
  _prev: LancamentoFormState,
  formData: FormData
): Promise<LancamentoFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "financeiro", "editar"))
    return { error: "Sem permissão." };

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
  const aplicarGrupo = formData.get("aplicar_grupo") === "true";

  if (!valorStr || isNaN(valor) || valor <= 0)
    return { error: "Informe um valor válido." };

  let isBulk = false;

  try {
    const current = await sql`
      SELECT status, remuneracao_id, grupo_parcelas,
             to_char(data_vencimento, 'YYYY-MM-DD') AS data_vencimento_iso
      FROM lancamentos WHERE id = ${id}::uuid
    `;
    if (current.length === 0) return { error: "Lançamento não encontrado." };
    const oldStatus = current[0].status as string;
    const remuneracaoId = current[0].remuneracao_id as string | null;
    const grupoParcelas = current[0].grupo_parcelas as string | null;
    const oldDataISO =
      (current[0].data_vencimento_iso as string | null) ?? todayBR();

    const hoje = todayBR();
    const dataVencFinal =
      status === "aguardando_resultado"
        ? "9999-12-31"
        : dataVencimento || todayBR();

    // ── Edição em lote: todas as parcelas do grupo ────────────────────────────
    if (aplicarGrupo && grupoParcelas) {
      isBulk = true;

      // Parcelas que já estavam pago/cancelado antes desta edição — o CASE
      // abaixo as preserva intactas, então não devem disparar de novo os
      // efeitos colaterais (comissão, notificação, lembrete) depois.
      const jaFinalizadas = await sql`
        SELECT id::text FROM lancamentos
        WHERE grupo_parcelas = ${grupoParcelas}::uuid AND status IN ('pago', 'cancelado')
      `;
      const jaFinalizadasIds = new Set(jaFinalizadas.map((r) => String(r.id)));

      // O delta em dias é calculado diretamente no SQL (date - date = integer).
      // Parcelas já pagas ou canceladas mantêm status e data de pagamento.
      // Parcelas pendentes têm as datas deslocadas proporcionalmente.
      await sql`
        UPDATE lancamentos SET
          tipo        = ${tipo},
          categoria   = ${categoria},
          descricao   = ${descricao},
          valor       = ${valor},
          client_id   = ${clientId ? clientId : null}::uuid,
          processo_id = ${processoId ? processoId : null}::uuid,
          observacoes = ${observacoes},
          data_vencimento = CASE
            WHEN ${status} = 'aguardando_resultado'   THEN '9999-12-31'::date
            WHEN status IN ('pago', 'cancelado')       THEN data_vencimento
            ELSE data_vencimento
                 + (${dataVencFinal}::date - ${oldDataISO}::date)
          END,
          status = CASE
            WHEN status IN ('pago', 'cancelado') THEN status
            ELSE ${status}
          END,
          data_pagamento = CASE
            WHEN status = 'pago'                              THEN data_pagamento
            WHEN ${status} = 'pago' AND status = 'pendente'  THEN ${hoje}::date
            ELSE NULL
          END
        WHERE grupo_parcelas = ${grupoParcelas}::uuid
      `;

      // Aplica pra cada parcela REALMENTE afetada os mesmos efeitos colaterais
      // que a edição individual já tinha — sem isso, marcar o grupo inteiro
      // como pago de uma vez pulava comissão do colaborador, notificação
      // PrevBot e cancelamento dos lembretes de cobrança dessas parcelas.
      const afetadas = await sql`
        SELECT id::text, valor, remuneracao_id, processo_id::text, client_id::text,
               to_char(data_vencimento, 'YYYY-MM-DD') AS data_vencimento_iso
        FROM lancamentos
        WHERE grupo_parcelas = ${grupoParcelas}::uuid
      `;

      for (const row of afetadas) {
        const rowId = String(row.id);
        if (jaFinalizadasIds.has(rowId)) continue;
        const rowValor = Number(row.valor);
        const rowRemId = row.remuneracao_id as string | null;
        const rowProcessoId = row.processo_id as string | null;
        const rowClientId = row.client_id as string | null;

        if (status === "pago") {
          if (rowRemId) {
            await sql`
              UPDATE remuneracoes SET
                status = 'pago', data_pagamento = ${hoje}::date, updated_at = NOW()
              WHERE id = ${rowRemId}::uuid
            `;
          }
          if (tipo === "entrada") {
            await notificarPrevBot({
              evento: "honorario_pago",
              processoId: rowProcessoId,
              clientId: rowClientId,
              dados: { valor_honorario: rowValor },
            }).catch(() => null);
            if (rowProcessoId) {
              await gerarComissaoAutomaticaPorPagamento(
                rowId,
                rowProcessoId,
                rowValor
              ).catch(() => null);
            }
          }
          await cancelarLembretesLancamento(rowId).catch(() => null);
        } else if (status === "cancelado") {
          if (rowRemId) {
            await sql`
              DELETE FROM remuneracoes WHERE id = ${rowRemId}::uuid AND status = 'pendente'
            `.catch(() => null);
          }
          await cancelarLembretesLancamento(rowId).catch(() => null);
        } else {
          if (rowRemId) {
            await sql`
              UPDATE remuneracoes SET
                status = 'pendente', data_pagamento = NULL, updated_at = NOW()
              WHERE id = ${rowRemId}::uuid
            `;
          }
          if (tipo === "entrada") {
            await reagendarLembretesHonorarioLancamento(
              rowId,
              rowClientId,
              rowValor,
              (row.data_vencimento_iso as string | null) ?? dataVencFinal,
              descricao
            );
          }
        }
      }
    } else {
      // ── Edição individual ──────────────────────────────────────────────────
      if (status === "pago" && oldStatus !== "pago") {
        await sql`
          UPDATE lancamentos SET
            tipo = ${tipo}, categoria = ${categoria}, descricao = ${descricao},
            valor = ${valor},
            client_id = ${clientId ? clientId : null}::uuid,
            processo_id = ${processoId ? processoId : null}::uuid,
            status = ${status}, data_vencimento = ${dataVencFinal}::date,
            data_pagamento = ${hoje}::date, observacoes = ${observacoes}
          WHERE id = ${id}::uuid
        `;
        if (remuneracaoId) {
          await sql`
            UPDATE remuneracoes SET
              status = 'pago', data_pagamento = ${hoje}::date, updated_at = NOW()
            WHERE id = ${remuneracaoId}::uuid
          `;
        }
        if (tipo === "entrada") {
          await notificarPrevBot({
            evento: "honorario_pago",
            processoId: processoId || null,
            clientId: clientId || null,
            dados: { valor_honorario: valor },
          });
          if (processoId) {
            await gerarComissaoAutomaticaPorPagamento(
              id,
              processoId,
              valor
            ).catch(() => null);
          }
        }
        await cancelarLembretesLancamento(id).catch(() => null);
      } else if (status === "cancelado" && oldStatus !== "cancelado") {
        await sql`
          UPDATE lancamentos SET
            tipo = ${tipo}, categoria = ${categoria}, descricao = ${descricao},
            valor = ${valor},
            client_id = ${clientId ? clientId : null}::uuid,
            processo_id = ${processoId ? processoId : null}::uuid,
            status = ${status}, data_vencimento = ${dataVencFinal}::date,
            data_pagamento = NULL, observacoes = ${observacoes}
          WHERE id = ${id}::uuid
        `;
        if (remuneracaoId) {
          await sql`
            DELETE FROM remuneracoes WHERE id = ${remuneracaoId}::uuid AND status = 'pendente'
          `.catch(() => null);
        }
        await cancelarLembretesLancamento(id).catch(() => null);
      } else if (status !== "pago") {
        await sql`
          UPDATE lancamentos SET
            tipo = ${tipo}, categoria = ${categoria}, descricao = ${descricao},
            valor = ${valor},
            client_id = ${clientId ? clientId : null}::uuid,
            processo_id = ${processoId ? processoId : null}::uuid,
            status = ${status}, data_vencimento = ${dataVencFinal}::date,
            data_pagamento = NULL, observacoes = ${observacoes}
          WHERE id = ${id}::uuid
        `;
        if (remuneracaoId && status !== oldStatus) {
          await sql`
            UPDATE remuneracoes SET
              status = 'pendente', data_pagamento = NULL, updated_at = NOW()
            WHERE id = ${remuneracaoId}::uuid
          `;
        }
        // Valor ou data podem ter mudado — atualiza os lembretes de cobrança
        // já agendados pra não ficarem com informação desatualizada/errada.
        if (tipo === "entrada") {
          await reagendarLembretesHonorarioLancamento(
            id,
            clientId,
            valor,
            dataVencFinal,
            descricao
          );
        }
      } else {
        await sql`
          UPDATE lancamentos SET
            tipo = ${tipo}, categoria = ${categoria}, descricao = ${descricao},
            valor = ${valor},
            client_id = ${clientId ? clientId : null}::uuid,
            processo_id = ${processoId ? processoId : null}::uuid,
            status = ${status}, data_vencimento = ${dataVencFinal}::date,
            observacoes = ${observacoes}
          WHERE id = ${id}::uuid
        `;
      }
    }
  } catch (err) {
    console.error(
      "updateLancamentoAction DB error:",
      err instanceof Error ? err.message : String(err)
    );
    return { error: "Erro ao atualizar lançamento. Tente novamente." };
  }

  await logAction({
    acao: "editar",
    entidade: "lancamento",
    entidadeId: id,
    descricao: isBulk
      ? `Editou grupo de parcelas — ${descricao}`
      : `Editou lançamento — ${descricao}`,
    detalhes: { valor, status, aplicar_grupo: isBulk },
  });

  redirect("/dashboard/financeiro");
}

export async function reagendarLancamentoAction(
  id: string,
  novaData: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "financeiro", "editar"))
    return { error: "Sem permissão." };
  if (!novaData) return { error: "Informe a nova data." };
  try {
    const rows = await sql`
      UPDATE lancamentos
      SET data_vencimento = ${novaData}::date
      WHERE id = ${id}::uuid AND status NOT IN ('pago', 'cancelado')
      RETURNING tipo, valor, client_id::text, descricao
    `;
    const row = rows[0] as
      | {
          tipo: string;
          valor: number;
          client_id: string | null;
          descricao: string;
        }
      | undefined;
    if (row?.tipo === "entrada") {
      await reagendarLembretesHonorarioLancamento(
        id,
        row.client_id,
        Number(row.valor),
        novaData,
        row.descricao
      );
    }
  } catch (err) {
    console.error("reagendarLancamentoAction DB error:", err);
    return { error: "Erro ao reagendar. Tente novamente." };
  }
  revalidatePath("/dashboard/financeiro");
  return {};
}

export async function markAsPagoAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "financeiro", "editar"))
    return { error: "Sem permissão." };
  try {
    const rows = await sql`
      UPDATE lancamentos
      SET status = 'pago', data_pagamento = ${todayBR()}::date
      WHERE id = ${id}::uuid
        AND status != 'pago'
      RETURNING remuneracao_id, client_id::text, processo_id::text, tipo, valor
    `;
    const lan = rows[0] as
      | {
          remuneracao_id: string | null;
          client_id: string | null;
          processo_id: string | null;
          tipo: string;
          valor: number;
        }
      | undefined;
    if (lan?.remuneracao_id) {
      await sql`
        UPDATE remuneracoes
        SET status = 'pago', data_pagamento = ${todayBR()}::date, updated_at = NOW()
        WHERE id = ${lan.remuneracao_id}::uuid
      `;
    }
    if (lan?.tipo === "entrada") {
      await notificarPrevBot({
        evento: "honorario_pago",
        processoId: lan.processo_id,
        clientId: lan.client_id,
        dados: { valor_honorario: lan.valor },
      });
      await gerarComissaoAutomaticaPorPagamento(
        id,
        lan.processo_id,
        Number(lan.valor)
      );
    }
    // Lembretes: cancela pendentes + envia confirmação de pagamento
    if (lan?.client_id && lan.tipo === "entrada") {
      await cancelarLembretesLancamento(id).catch(() => null);
      const clienteRows = await sql`
        SELECT name, phone, menor_incapaz, responsavel_nome, responsavel_telefone
        FROM clients WHERE id = ${lan.client_id}::uuid LIMIT 1
      `.catch(() => []);
      if (clienteRows.length > 0) {
        const pendentesRows = await sql`
          SELECT COALESCE(SUM(valor), 0) AS total
          FROM lancamentos
          WHERE client_id = ${lan.client_id}::uuid
            AND tipo = 'entrada'
            AND status = 'pendente'
        `.catch(() => []);
        const saldo = Number(pendentesRows[0]?.total ?? 0);
        const respLegal =
          clienteRows[0].menor_incapaz &&
          clienteRows[0].responsavel_nome &&
          clienteRows[0].responsavel_telefone
            ? {
                nome: String(clienteRows[0].responsavel_nome),
                telefone: String(clienteRows[0].responsavel_telefone),
              }
            : null;
        await agendarConfirmacaoPagamento({
          lancamentoId: id,
          clienteId: lan.client_id,
          clienteNome: String(clienteRows[0].name),
          telefone: clienteRows[0].phone ? String(clienteRows[0].phone) : null,
          responsavel: respLegal,
          valorPago: Number(lan.valor),
          dataPagamento: new Date(),
          saldoRestante: saldo,
        }).catch(() => null);
      }
    }
  } catch (err) {
    console.error("markAsPagoAction DB error:", err);
    return { error: "Erro ao marcar como pago. Tente novamente." };
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
  return {};
}

// ── Baixa em lote ─────────────────────────────────────────────────────────────

export async function markMultiplePagoAction(
  ids: string[]
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "financeiro", "editar"))
    return { error: "Sem permissão." };
  if (ids.length === 0) return {};

  try {
    const rows = await sql`
      UPDATE lancamentos
      SET status = 'pago', data_pagamento = ${todayBR()}::date
      WHERE id = ANY(${ids}::uuid[])
        AND status != 'pago'
      RETURNING id::text, client_id::text, processo_id::text, tipo, valor, remuneracao_id
    `;

    for (const lan of rows) {
      if (lan.remuneracao_id) {
        await sql`
          UPDATE remuneracoes
          SET status = 'pago', data_pagamento = ${todayBR()}::date, updated_at = NOW()
          WHERE id = ${lan.remuneracao_id}::uuid
        `;
      }
      if (lan.tipo === "entrada" && lan.processo_id) {
        await gerarComissaoAutomaticaPorPagamento(
          String(lan.id),
          String(lan.processo_id),
          Number(lan.valor)
        );
      }
      await cancelarLembretesLancamento(String(lan.id)).catch(() => null);
    }

    // One confirmation notification per client (total paid)
    const byClient = new Map<string, number>();
    for (const lan of rows) {
      if (lan.client_id && lan.tipo === "entrada") {
        byClient.set(
          String(lan.client_id),
          (byClient.get(String(lan.client_id)) ?? 0) + Number(lan.valor)
        );
      }
    }

    for (const [clientId, totalValor] of byClient) {
      const cr = await sql`
        SELECT name, phone, menor_incapaz, responsavel_nome, responsavel_telefone
        FROM clients WHERE id = ${clientId}::uuid LIMIT 1
      `.catch(() => []);
      if (!cr.length) continue;

      const pr = await sql`
        SELECT COALESCE(SUM(valor), 0) AS total
        FROM lancamentos
        WHERE client_id = ${clientId}::uuid AND tipo = 'entrada' AND status = 'pendente'
      `.catch(() => []);
      const saldo = Number(pr[0]?.total ?? 0);
      const respLegal =
        cr[0].menor_incapaz &&
        cr[0].responsavel_nome &&
        cr[0].responsavel_telefone
          ? {
              nome: String(cr[0].responsavel_nome),
              telefone: String(cr[0].responsavel_telefone),
            }
          : null;

      const firstId = rows.find((r) => String(r.client_id) === clientId)?.id;
      await agendarConfirmacaoPagamento({
        lancamentoId: String(firstId ?? ids[0]),
        clienteId: clientId,
        clienteNome: String(cr[0].name),
        telefone: cr[0].phone ? String(cr[0].phone) : null,
        responsavel: respLegal,
        valorPago: totalValor,
        dataPagamento: new Date(),
        saldoRestante: saldo,
      }).catch(() => null);
    }
  } catch (err) {
    console.error("markMultiplePagoAction DB error:", err);
    return { error: "Erro ao marcar como pago. Tente novamente." };
  }

  revalidatePath("/dashboard/financeiro");
  return {};
}

// ── Pagamento parcial ─────────────────────────────────────────────────────────
// Distributes `valorPago` across the given pending lancamento IDs (sorted by
// due date). Fully covered rows are marked paid; the partially covered row is
// updated to the paid portion and a new pending row is inserted for the
// remainder.

export async function pagamentoParcialAction(opts: {
  ids: string[];
  valorPago: number;
  clientId: string;
}): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "financeiro", "editar"))
    return { error: "Sem permissão." };
  if (opts.ids.length === 0 || opts.valorPago <= 0)
    return { error: "Informe um valor válido." };

  try {
    const rows = await sql`
      SELECT id::text, valor, descricao, categoria, tipo,
             processo_id::text, data_vencimento::text, grupo_parcelas::text
      FROM lancamentos
      WHERE id = ANY(${opts.ids}::uuid[])
        AND status != 'pago'
      ORDER BY data_vencimento ASC NULLS LAST
    `;

    let remaining = opts.valorPago;
    const paidIds: string[] = [];

    for (const row of rows) {
      if (remaining <= 0) break;
      const itemValor = Number(row.valor);

      if (remaining >= itemValor) {
        // Guarda "AND status != 'pago'" + RETURNING é o que garante que, sob
        // concorrência (double-click, duas abas), só a chamada que realmente
        // conseguiu marcar a linha como paga processa o efeito colateral —
        // sem isso, duas chamadas paralelas liam a mesma linha "pendente" e
        // cada uma abatia o valor do "remaining" e criava sua própria linha
        // de "saldo restante", duplicando a dívida do cliente.
        const upd = await sql`
          UPDATE lancamentos
          SET status = 'pago', data_pagamento = ${todayBR()}::date
          WHERE id = ${row.id}::uuid AND status != 'pago'
          RETURNING remuneracao_id
        `;
        if (upd.length === 0) continue;
        paidIds.push(String(row.id));
        if (upd[0].remuneracao_id) {
          await sql`
            UPDATE remuneracoes
            SET status = 'pago', data_pagamento = ${todayBR()}::date, updated_at = NOW()
            WHERE id = ${upd[0].remuneracao_id}::uuid
          `;
        }
        if (row.tipo === "entrada" && row.processo_id) {
          await gerarComissaoAutomaticaPorPagamento(
            String(row.id),
            String(row.processo_id),
            itemValor
          );
        }
        remaining = Math.round((remaining - itemValor) * 100) / 100;
      } else {
        // Partial: update existing to paid portion; insert remainder as new row
        const paidPortion = Math.round(remaining * 100) / 100;
        const restante = Math.round((itemValor - paidPortion) * 100) / 100;

        const upd = await sql`
          UPDATE lancamentos
          SET valor = ${paidPortion}, status = 'pago', data_pagamento = ${todayBR()}::date
          WHERE id = ${row.id}::uuid AND status != 'pago'
          RETURNING remuneracao_id
        `;
        if (upd.length === 0) continue;
        paidIds.push(String(row.id));
        if (upd[0].remuneracao_id) {
          await sql`
            UPDATE remuneracoes
            SET status = 'pago', data_pagamento = ${todayBR()}::date, updated_at = NOW()
            WHERE id = ${upd[0].remuneracao_id}::uuid
          `;
        }
        if (row.tipo === "entrada" && row.processo_id) {
          await gerarComissaoAutomaticaPorPagamento(
            String(row.id),
            String(row.processo_id),
            paidPortion
          );
        }

        await sql`
          INSERT INTO lancamentos
            (tipo, categoria, descricao, valor, client_id, processo_id,
             status, data_vencimento, grupo_parcelas, observacoes)
          VALUES
            (${row.tipo}, ${row.categoria ?? null},
             ${String(row.descricao) + " — saldo restante"},
             ${restante},
             ${opts.clientId}::uuid,
             ${row.processo_id ? row.processo_id : null}::uuid,
             'pendente',
             ${row.data_vencimento ?? todayBR()}::date,
             ${row.grupo_parcelas ? row.grupo_parcelas : null}::uuid,
             'Gerado automaticamente por pagamento parcial')
        `;

        remaining = 0;
      }
    }

    for (const pid of paidIds) {
      await cancelarLembretesLancamento(pid).catch(() => null);
    }

    const cr = await sql`
      SELECT name, phone, menor_incapaz, responsavel_nome, responsavel_telefone
      FROM clients WHERE id = ${opts.clientId}::uuid LIMIT 1
    `.catch(() => []);

    if (cr.length > 0) {
      const pr = await sql`
        SELECT COALESCE(SUM(valor), 0) AS total
        FROM lancamentos
        WHERE client_id = ${opts.clientId}::uuid AND tipo = 'entrada' AND status = 'pendente'
      `.catch(() => []);
      const saldo = Number(pr[0]?.total ?? 0);
      const respLegal =
        cr[0].menor_incapaz &&
        cr[0].responsavel_nome &&
        cr[0].responsavel_telefone
          ? {
              nome: String(cr[0].responsavel_nome),
              telefone: String(cr[0].responsavel_telefone),
            }
          : null;

      await agendarConfirmacaoPagamento({
        lancamentoId: paidIds[0] ?? opts.ids[0],
        clienteId: opts.clientId,
        clienteNome: String(cr[0].name),
        telefone: cr[0].phone ? String(cr[0].phone) : null,
        responsavel: respLegal,
        valorPago: opts.valorPago,
        dataPagamento: new Date(),
        saldoRestante: saldo,
      }).catch(() => null);
    }
  } catch (err) {
    console.error("pagamentoParcialAction DB error:", err);
    return { error: "Erro ao registrar pagamento. Tente novamente." };
  }

  revalidatePath("/dashboard/financeiro");
  return {};
}

export async function deleteLancamentoAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "financeiro", "excluir"))
    return { error: "Sem permissão." };
  try {
    const rows = await sql`
      DELETE FROM lancamentos WHERE id = ${id}::uuid
      RETURNING remuneracao_id, valor, descricao, tipo, status
    `;
    const lan = rows[0] as
      | {
          remuneracao_id: string | null;
          valor: number;
          descricao: string;
          tipo: string;
          status: string;
        }
      | undefined;
    if (lan?.remuneracao_id) {
      // Deleting the remuneração would normally cascade back, but the lancamento
      // is already gone — so we just clean up the remuneração record directly.
      await sql`DELETE FROM remuneracoes WHERE id = ${lan.remuneracao_id}::uuid`;
    }
    // Excluir o lançamento não apaga automaticamente lembretes de cobrança
    // já agendados — sem isso, o cliente recebia cobrança do WhatsApp de uma
    // dívida que já não existe mais no sistema.
    await cancelarLembretesLancamento(id).catch(() => null);

    await logAction({
      acao: "excluir",
      entidade: "lancamento",
      entidadeId: id,
      descricao: lan
        ? `Excluiu lançamento — ${lan.descricao} (R$ ${Number(lan.valor).toFixed(2)}, ${lan.status})`
        : "Excluiu lançamento",
      detalhes: lan
        ? {
            valor: Number(lan.valor),
            descricao: lan.descricao,
            tipo: lan.tipo,
            status: lan.status,
          }
        : undefined,
      _login: session?.login ?? "sistema",
      _cat: session?.categoria ? String(session.categoria) : undefined,
    });
  } catch (err) {
    console.error("deleteLancamentoAction DB error:", err);
    return { error: "Erro ao excluir lançamento. Tente novamente." };
  }
  revalidatePath("/dashboard/financeiro");
  return {};
}

export async function revertParaPendenteAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "financeiro", "editar"))
    return { error: "Sem permissão." };
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
    // Se esse lançamento (pagamento do cliente) tinha gerado uma comissão
    // automática ainda não paga ao colaborador, ela deixa de fazer sentido —
    // remove (ON DELETE CASCADE já apaga o lançamento "saída" espelhado).
    // Se já tiver sido paga ao colaborador, não mexe — fica pra revisão manual.
    await sql`
      DELETE FROM remuneracoes
      WHERE origem_lancamento_id = ${id}::uuid AND status = 'pendente'
    `;
  } catch (err) {
    console.error("revertParaPendenteAction DB error:", err);
    return { error: "Erro ao reverter lançamento. Tente novamente." };
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
  return {};
}

export async function ativarLancamentoAction(
  id: string,
  dataVencimento: string
): Promise<{ ok: boolean; erro?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "financeiro", "editar"))
    return { ok: false, erro: "Sem permissão." };
  if (!dataVencimento)
    return { ok: false, erro: "Informe a data de vencimento." };
  try {
    const rows = await sql`
      UPDATE lancamentos
      SET status = 'pendente', data_vencimento = ${dataVencimento}::date
      WHERE id = ${id}::uuid AND status = 'aguardando_resultado'
      RETURNING tipo, valor, client_id::text, descricao
    `;
    // Enquanto "aguardando resultado" o lançamento nunca teve lembrete de
    // cobrança agendado (não tinha data real) — agora que a data foi
    // definida, é a primeira vez que dá pra agendar.
    const row = rows[0] as
      | {
          tipo: string;
          valor: number;
          client_id: string | null;
          descricao: string;
        }
      | undefined;
    if (row?.tipo === "entrada") {
      await reagendarLembretesHonorarioLancamento(
        id,
        row.client_id,
        Number(row.valor),
        dataVencimento,
        row.descricao
      );
    }
  } catch (err) {
    console.error("ativarLancamentoAction DB error:", err);
    return { ok: false, erro: "Erro ao ativar lançamento." };
  }
  await logAction({
    acao: "editar",
    entidade: "lancamento",
    entidadeId: id,
    descricao: "Definiu data de vencimento — resultado confirmado",
    detalhes: { dataVencimento },
  });
  revalidatePath("/dashboard/financeiro");
  return { ok: true };
}

const UUID_RE_ACT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function cancelarParcelasAction(
  ids: string[]
): Promise<{ ok: boolean; cancelados: number; error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "financeiro", "editar"))
    return { ok: false, cancelados: 0, error: "Sem permissão." };

  const validIds = ids.filter((id) => UUID_RE_ACT.test(id));
  if (validIds.length === 0) return { ok: true, cancelados: 0 };

  const rows = await sql`
    UPDATE lancamentos
    SET status = 'cancelado'
    WHERE id = ANY(${validIds}::uuid[])
      AND status = 'pendente'
    RETURNING id::text, remuneracao_id
  `;

  // Parcela cancelada não vai gerar receita nenhuma — a comissão de
  // indicador vinculada a ela (se ainda não foi paga) deixa de fazer
  // sentido, senão o escritório acaba pagando comissão de um pagamento
  // que o cliente nunca fez. E cancela o lembrete de cobrança pendente.
  for (const row of rows) {
    const rowId = String(row.id);
    const remId = row.remuneracao_id as string | null;
    if (remId) {
      await sql`
        DELETE FROM remuneracoes WHERE id = ${remId}::uuid AND status = 'pendente'
      `.catch(() => null);
    }
    await cancelarLembretesLancamento(rowId).catch(() => null);
  }

  revalidatePath("/dashboard/financeiro");
  return { ok: true, cancelados: rows.length };
}

export async function deleteGrupoAction(
  grupoParcelas: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "financeiro", "excluir"))
    return { error: "Sem permissão." };
  const UUID_RE_DG =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE_DG.test(grupoParcelas)) return { error: "ID inválido." };
  try {
    const rows = await sql`
      DELETE FROM lancamentos
      WHERE grupo_parcelas = ${grupoParcelas}::uuid
      RETURNING id::text, remuneracao_id, valor, status
    `;

    // Mesmo tratamento de deleteLancamentoAction, só que pra cada parcela do
    // grupo inteiro: limpa a comissão de indicador vinculada (senão fica
    // órfã, pendente pra sempre) e cancela os lembretes de cobrança de cada
    // parcela apagada.
    let totalExcluido = 0;
    for (const row of rows) {
      const remId = row.remuneracao_id as string | null;
      if (remId) {
        await sql`DELETE FROM remuneracoes WHERE id = ${remId}::uuid`.catch(
          () => null
        );
      }
      await cancelarLembretesLancamento(String(row.id)).catch(() => null);
      totalExcluido += Number(row.valor);
    }

    await logAction({
      acao: "excluir",
      entidade: "lancamento",
      entidadeId: grupoParcelas,
      descricao: `Excluiu grupo de parcelas (${rows.length} lançamento${rows.length === 1 ? "" : "s"}, total R$ ${totalExcluido.toFixed(2)})`,
      detalhes: {
        grupoParcelas,
        quantidade: rows.length,
        total: totalExcluido,
      },
      _login: session?.login ?? "sistema",
      _cat: session?.categoria ? String(session.categoria) : undefined,
    });
  } catch (err) {
    console.error("deleteGrupoAction DB error:", err);
    return { error: "Erro ao excluir grupo de parcelas. Tente novamente." };
  }
  revalidatePath("/dashboard/financeiro");
  return {};
}
