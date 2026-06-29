"use server";

import { redirect } from "next/navigation";
import sql from "./db";
import { logAction } from "./audit";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { notificarPrevBot } from "./prevbot-outbound";

export type ProcessoFormState = { error: string } | null;

export async function createProcessoAction(
  _prev: ProcessoFormState,
  formData: FormData
): Promise<ProcessoFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "criar"))
    return { error: "Sem permissão." };

  const clientId = ((formData.get("client_id") as string | null) ?? "").trim();
  const numero =
    ((formData.get("numero") as string | null) ?? "").trim() || null;
  const tipoAcao = ((formData.get("tipo_acao") as string | null) ?? "").trim();
  const area = ((formData.get("area") as string | null) ?? "").trim();
  const fase = ((formData.get("fase") as string | null) ?? "").trim() || null;
  const vara = ((formData.get("vara") as string | null) ?? "").trim() || null;
  const comarca =
    ((formData.get("comarca") as string | null) ?? "").trim() || null;
  const parteContraria =
    ((formData.get("parte_contraria") as string | null) ?? "").trim() || null;
  const parteContrariaDoc =
    ((formData.get("parte_contraria_doc") as string | null) ?? "").trim() ||
    null;
  const valorCausaRaw = (
    (formData.get("valor_causa") as string | null) ?? ""
  ).trim();
  const valorCausa = valorCausaRaw ? Number(valorCausaRaw) : null;
  const dataDistribuicao =
    (formData.get("data_distribuicao") as string | null) || null;
  const notas = ((formData.get("notas") as string | null) ?? "").trim() || null;

  // Campos previdenciários
  const dataProtocoloInss =
    (formData.get("data_protocolo_inss") as string | null) || null;
  const protocoloInss =
    ((formData.get("protocolo_inss") as string | null) ?? "").trim() || null;
  const agenciaInss =
    ((formData.get("agencia_inss") as string | null) ?? "").trim() || null;
  const resultadoAdmin =
    ((formData.get("resultado_admin") as string | null) ?? "").trim() || null;
  const dataResultadoAdmin =
    (formData.get("data_resultado_admin") as string | null) || null;
  const motivoIndeferimento =
    ((formData.get("motivo_indeferimento") as string | null) ?? "").trim() ||
    null;
  const modeloHonorario =
    ((formData.get("modelo_honorario") as string | null) ?? "").trim() || null;
  const valorHonorarioRaw = (
    (formData.get("valor_honorario") as string | null) ?? ""
  )
    .replace(/\./g, "")
    .replace(",", ".");
  const valorHonorario = valorHonorarioRaw ? Number(valorHonorarioRaw) : null;
  const percentualHonorarioRaw = (
    (formData.get("percentual_honorario") as string | null) ?? ""
  ).replace(",", ".");
  const percentualHonorario = percentualHonorarioRaw
    ? Number(percentualHonorarioRaw)
    : null;
  const numBeneficioConcedido =
    ((formData.get("num_beneficio_concedido") as string | null) ?? "").trim() ||
    null;
  const der = (formData.get("der") as string | null) || null;
  const dib = (formData.get("dib") as string | null) || null;
  const dcb = (formData.get("dcb") as string | null) || null;

  if (!clientId) return { error: "Selecione um cliente." };
  if (!tipoAcao) return { error: "Informe o tipo de ação." };
  if (!area) return { error: "Selecione a área jurídica." };

  try {
    await sql`
      INSERT INTO processos
        (client_id, numero, tipo_acao, area, fase, vara, comarca,
         parte_contraria, parte_contraria_doc, valor_causa,
         data_distribuicao, notas,
         data_protocolo_inss, protocolo_inss, agencia_inss,
         resultado_admin, data_resultado_admin, motivo_indeferimento,
         modelo_honorario, valor_honorario, percentual_honorario,
         num_beneficio_concedido, der, dib, dcb)
      VALUES
        (${clientId}::uuid, ${numero}, ${tipoAcao}, ${area}, ${fase},
         ${vara}, ${comarca}, ${parteContraria}, ${parteContrariaDoc},
         ${valorCausa},
         ${dataDistribuicao ? dataDistribuicao : null}::date,
         ${notas},
         ${dataProtocoloInss}::date, ${protocoloInss}, ${agenciaInss},
         ${resultadoAdmin}, ${dataResultadoAdmin}::date, ${motivoIndeferimento},
         ${modeloHonorario}, ${valorHonorario}, ${percentualHonorario},
         ${numBeneficioConcedido}, ${der}::date, ${dib}::date, ${dcb}::date)
    `;
  } catch (err) {
    console.error("createProcessoAction DB error:", err);
    return { error: "Erro ao salvar processo. Tente novamente." };
  }

  const rawRedirect = ((formData.get("redirect_to") as string | null) ?? "").trim();
  const redirectTo = rawRedirect.startsWith("/") ? rawRedirect : "/dashboard/processos";

  await logAction({
    acao: "criar",
    entidade: "processo",
    descricao: `Abriu processo: ${tipoAcao}`,
    detalhes: { tipoAcao, area },
  });

  redirect(redirectTo);
}

export async function updateProcessoAction(
  id: string,
  _prev: ProcessoFormState,
  formData: FormData
): Promise<ProcessoFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "editar"))
    return { error: "Sem permissão." };

  const clientId = ((formData.get("client_id") as string | null) ?? "").trim();
  const numero =
    ((formData.get("numero") as string | null) ?? "").trim() || null;
  const tipoAcao = ((formData.get("tipo_acao") as string | null) ?? "").trim();
  const area = ((formData.get("area") as string | null) ?? "").trim();
  const fase = ((formData.get("fase") as string | null) ?? "").trim() || null;
  const vara = ((formData.get("vara") as string | null) ?? "").trim() || null;
  const comarca =
    ((formData.get("comarca") as string | null) ?? "").trim() || null;
  const parteContraria =
    ((formData.get("parte_contraria") as string | null) ?? "").trim() || null;
  const parteContrariaDoc =
    ((formData.get("parte_contraria_doc") as string | null) ?? "").trim() ||
    null;
  const valorCausaRaw = (
    (formData.get("valor_causa") as string | null) ?? ""
  ).trim();
  const valorCausa = valorCausaRaw ? Number(valorCausaRaw) : null;
  const dataDistribuicao =
    (formData.get("data_distribuicao") as string | null) || null;
  const notas = ((formData.get("notas") as string | null) ?? "").trim() || null;
  const status = ((formData.get("status") as string | null) ?? "ativo").trim();

  // Campos previdenciários
  const dataProtocoloInss =
    (formData.get("data_protocolo_inss") as string | null) || null;
  const protocoloInss =
    ((formData.get("protocolo_inss") as string | null) ?? "").trim() || null;
  const agenciaInss =
    ((formData.get("agencia_inss") as string | null) ?? "").trim() || null;
  const resultadoAdmin =
    ((formData.get("resultado_admin") as string | null) ?? "").trim() || null;
  const dataResultadoAdmin =
    (formData.get("data_resultado_admin") as string | null) || null;
  const motivoIndeferimento =
    ((formData.get("motivo_indeferimento") as string | null) ?? "").trim() ||
    null;
  const modeloHonorario =
    ((formData.get("modelo_honorario") as string | null) ?? "").trim() || null;
  const valorHonorarioRaw = (
    (formData.get("valor_honorario") as string | null) ?? ""
  )
    .replace(/\./g, "")
    .replace(",", ".");
  const valorHonorario = valorHonorarioRaw ? Number(valorHonorarioRaw) : null;
  const percentualHonorarioRaw = (
    (formData.get("percentual_honorario") as string | null) ?? ""
  ).replace(",", ".");
  const percentualHonorario = percentualHonorarioRaw
    ? Number(percentualHonorarioRaw)
    : null;
  const numBeneficioConcedido =
    ((formData.get("num_beneficio_concedido") as string | null) ?? "").trim() ||
    null;
  const der = (formData.get("der") as string | null) || null;
  const dib = (formData.get("dib") as string | null) || null;
  const dcb = (formData.get("dcb") as string | null) || null;

  if (!clientId) return { error: "Selecione um cliente." };
  if (!tipoAcao) return { error: "Informe o tipo de ação." };
  if (!area) return { error: "Selecione a área jurídica." };

  // Lê estado anterior para detectar mudanças relevantes
  const prev = await sql`
    SELECT resultado_admin, status FROM processos
    WHERE id = ${id}::uuid AND deleted_at IS NULL LIMIT 1
  `;
  const prevResultadoAdmin =
    prev.length > 0 ? (prev[0].resultado_admin as string | null) : null;
  const prevStatus = prev.length > 0 ? (prev[0].status as string | null) : null;

  try {
    await sql`
      UPDATE processos SET
        client_id               = ${clientId}::uuid,
        numero                  = ${numero},
        tipo_acao               = ${tipoAcao},
        area                    = ${area},
        fase                    = ${fase},
        vara                    = ${vara},
        comarca                 = ${comarca},
        parte_contraria         = ${parteContraria},
        parte_contraria_doc     = ${parteContrariaDoc},
        valor_causa             = ${valorCausa},
        data_distribuicao       = ${dataDistribuicao ? dataDistribuicao : null}::date,
        notas                   = ${notas},
        status                  = ${status},
        data_protocolo_inss     = ${dataProtocoloInss}::date,
        protocolo_inss          = ${protocoloInss},
        agencia_inss            = ${agenciaInss},
        resultado_admin         = ${resultadoAdmin},
        data_resultado_admin    = ${dataResultadoAdmin}::date,
        motivo_indeferimento    = ${motivoIndeferimento},
        modelo_honorario        = ${modeloHonorario},
        valor_honorario         = ${valorHonorario},
        percentual_honorario    = ${percentualHonorario},
        num_beneficio_concedido = ${numBeneficioConcedido},
        der                     = ${der}::date,
        dib                     = ${dib}::date,
        dcb                     = ${dcb}::date,
        updated_at              = NOW()
      WHERE id = ${id}::uuid
    `;
  } catch (err) {
    console.error("updateProcessoAction DB error:", err);
    return { error: "Erro ao atualizar processo. Tente novamente." };
  }

  // Notifica PrevBot quando resultado muda para deferido/indeferido,
  // ou quando processo é encerrado por outros motivos (extinto)
  if (resultadoAdmin !== prevResultadoAdmin) {
    if (resultadoAdmin === "deferido") {
      await notificarPrevBot({
        evento: "processo_deferido",
        processoId: id,
        dados: { observacoes: motivoIndeferimento ?? undefined },
      });
    } else if (resultadoAdmin === "indeferido") {
      await notificarPrevBot({
        evento: "processo_indeferido",
        processoId: id,
        dados: { observacoes: motivoIndeferimento ?? undefined },
      });
    }
  }
  if (
    status === "encerrado" &&
    prevStatus !== "encerrado" &&
    resultadoAdmin !== "deferido" &&
    resultadoAdmin !== "indeferido"
  ) {
    await notificarPrevBot({ evento: "processo_extinto", processoId: id });
  }

  await logAction({
    acao: "editar",
    entidade: "processo",
    entidadeId: id,
    descricao: `Editou processo: ${tipoAcao}`,
    detalhes: { status },
  });

  redirect(`/dashboard/processos/${id}`);
}

export async function deleteProcessoAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "excluir")) return;

  try {
    await sql`UPDATE processos SET deleted_at = NOW() WHERE id = ${id}::uuid AND deleted_at IS NULL`;
  } catch (err) {
    console.error("deleteProcessoAction DB error:", err);
    return;
  }
  await logAction({
    acao: "excluir",
    entidade: "processo",
    entidadeId: id,
    descricao: "Excluiu processo",
  });
  redirect("/dashboard/processos");
}
