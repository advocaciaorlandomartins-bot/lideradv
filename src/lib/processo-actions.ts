"use server";

import { redirect } from "next/navigation";
import sql from "./db";

export type ProcessoFormState = { error: string } | null;

export async function createProcessoAction(
  _prev: ProcessoFormState,
  formData: FormData
): Promise<ProcessoFormState> {
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

  if (!clientId) return { error: "Selecione um cliente." };
  if (!tipoAcao) return { error: "Informe o tipo de ação." };
  if (!area) return { error: "Selecione a área jurídica." };

  try {
    await sql`
      INSERT INTO processos
        (client_id, numero, tipo_acao, area, fase, vara, comarca,
         parte_contraria, parte_contraria_doc, valor_causa,
         data_distribuicao, notas)
      VALUES
        (${clientId}::uuid, ${numero}, ${tipoAcao}, ${area}, ${fase},
         ${vara}, ${comarca}, ${parteContraria}, ${parteContrariaDoc},
         ${valorCausa},
         ${dataDistribuicao ? dataDistribuicao : null}::date,
         ${notas})
    `;
  } catch (err) {
    console.error("createProcessoAction DB error:", err);
    return { error: "Erro ao salvar processo. Tente novamente." };
  }

  redirect("/dashboard/processos");
}

export async function updateProcessoAction(
  id: string,
  _prev: ProcessoFormState,
  formData: FormData
): Promise<ProcessoFormState> {
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

  if (!clientId) return { error: "Selecione um cliente." };
  if (!tipoAcao) return { error: "Informe o tipo de ação." };
  if (!area) return { error: "Selecione a área jurídica." };

  try {
    await sql`
      UPDATE processos SET
        client_id           = ${clientId}::uuid,
        numero              = ${numero},
        tipo_acao           = ${tipoAcao},
        area                = ${area},
        fase                = ${fase},
        vara                = ${vara},
        comarca             = ${comarca},
        parte_contraria     = ${parteContraria},
        parte_contraria_doc = ${parteContrariaDoc},
        valor_causa         = ${valorCausa},
        data_distribuicao   = ${dataDistribuicao ? dataDistribuicao : null}::date,
        notas               = ${notas},
        status              = ${status},
        updated_at          = NOW()
      WHERE id = ${id}::uuid
    `;
  } catch (err) {
    console.error("updateProcessoAction DB error:", err);
    return { error: "Erro ao atualizar processo. Tente novamente." };
  }

  redirect(`/dashboard/processos/${id}`);
}

export async function deleteProcessoAction(id: string): Promise<void> {
  try {
    await sql`DELETE FROM processos WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("deleteProcessoAction DB error:", err);
    return;
  }
  redirect("/dashboard/processos");
}
