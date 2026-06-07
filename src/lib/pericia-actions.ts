"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { logAction } from "./audit";

export type PericiaFormState = { error: string } | null;

function getFields(formData: FormData) {
  return {
    tipo: ((formData.get("tipo") as string | null) ?? "").trim(),
    clientId: ((formData.get("client_id") as string | null) ?? "").trim(),
    processoId:
      ((formData.get("processo_id") as string | null) ?? "").trim() || null,
    dataPericia: ((formData.get("data_pericia") as string | null) ?? "").trim(),
    horaPericia:
      ((formData.get("hora_pericia") as string | null) ?? "").trim() || null,
    localPericia:
      ((formData.get("local_pericia") as string | null) ?? "").trim() || null,
    perito: ((formData.get("perito") as string | null) ?? "").trim() || null,
    especialidade:
      ((formData.get("especialidade") as string | null) ?? "").trim() || null,
    status: ((formData.get("status") as string | null) ?? "agendado").trim(),
    resultado:
      ((formData.get("resultado") as string | null) ?? "").trim() || null,
    beneficioNumero:
      ((formData.get("beneficio_numero") as string | null) ?? "").trim() ||
      null,
    beneficioTipo:
      ((formData.get("beneficio_tipo") as string | null) ?? "").trim() || null,
    dataFimBeneficio:
      (formData.get("data_fim_beneficio") as string | null) || null,
    novaDataFim: (formData.get("nova_data_fim") as string | null) || null,
    observacoes:
      ((formData.get("observacoes") as string | null) ?? "").trim() || null,
  };
}

export async function createPericiaAction(
  _prev: PericiaFormState,
  formData: FormData
): Promise<PericiaFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "criar"))
    return { error: "Sem permissão." };

  const f = getFields(formData);

  if (!f.tipo) return { error: "Selecione o tipo de perícia." };
  if (!f.clientId) return { error: "Selecione o cliente." };
  if (!f.dataPericia) return { error: "Informe a data da perícia." };

  try {
    await sql`
      INSERT INTO pericias (
        tipo, client_id, processo_id, data_pericia, hora_pericia,
        local_pericia, perito, especialidade, status, resultado,
        beneficio_numero, beneficio_tipo,
        data_fim_beneficio, nova_data_fim, observacoes
      ) VALUES (
        ${f.tipo},
        ${f.clientId}::uuid,
        ${f.processoId ? f.processoId : null}::uuid,
        ${f.dataPericia}::date,
        ${f.horaPericia ? f.horaPericia : null}::time,
        ${f.localPericia}, ${f.perito}, ${f.especialidade},
        ${f.status}, ${f.resultado},
        ${f.beneficioNumero}, ${f.beneficioTipo},
        ${f.dataFimBeneficio ? f.dataFimBeneficio : null}::date,
        ${f.novaDataFim ? f.novaDataFim : null}::date,
        ${f.observacoes}
      )
    `;
  } catch (err) {
    console.error("createPericiaAction DB error:", err);
    return { error: "Erro ao salvar perícia. Tente novamente." };
  }

  await logAction({
    acao: "criar",
    entidade: "pericia",
    descricao: `Cadastrou perícia: ${f.tipo}`,
    detalhes: { tipo: f.tipo, data: f.dataPericia },
  });

  redirect("/dashboard/pericias");
}

export async function updatePericiaAction(
  id: string,
  _prev: PericiaFormState,
  formData: FormData
): Promise<PericiaFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "editar"))
    return { error: "Sem permissão." };

  const f = getFields(formData);

  if (!f.tipo) return { error: "Selecione o tipo de perícia." };
  if (!f.clientId) return { error: "Selecione o cliente." };
  if (!f.dataPericia) return { error: "Informe a data da perícia." };

  try {
    await sql`
      UPDATE pericias SET
        tipo               = ${f.tipo},
        client_id          = ${f.clientId}::uuid,
        processo_id        = ${f.processoId ? f.processoId : null}::uuid,
        data_pericia       = ${f.dataPericia}::date,
        hora_pericia       = ${f.horaPericia ? f.horaPericia : null}::time,
        local_pericia      = ${f.localPericia},
        perito             = ${f.perito},
        especialidade      = ${f.especialidade},
        status             = ${f.status},
        resultado          = ${f.resultado},
        beneficio_numero   = ${f.beneficioNumero},
        beneficio_tipo     = ${f.beneficioTipo},
        data_fim_beneficio = ${f.dataFimBeneficio ? f.dataFimBeneficio : null}::date,
        nova_data_fim      = ${f.novaDataFim ? f.novaDataFim : null}::date,
        observacoes        = ${f.observacoes},
        updated_at         = NOW()
      WHERE id = ${id}::uuid
    `;
  } catch (err) {
    console.error("updatePericiaAction DB error:", err);
    return { error: "Erro ao atualizar perícia. Tente novamente." };
  }

  await logAction({
    acao: "editar",
    entidade: "pericia",
    entidadeId: id,
    descricao: `Editou perícia: ${f.tipo}`,
  });

  redirect(`/dashboard/pericias/${id}`);
}

export async function markPericiaRealizadaAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "editar")) return;

  try {
    await sql`
      UPDATE pericias SET status = 'realizado', updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
  } catch (err) {
    console.error("markPericiaRealizadaAction DB error:", err);
  }
  await logAction({
    acao: "editar",
    entidade: "pericia",
    entidadeId: id,
    descricao: "Marcou perícia como realizada",
  });
  revalidatePath("/dashboard/pericias");
}

export async function deletePericiaAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "controles", "excluir")) return;

  try {
    await sql`DELETE FROM pericias WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("deletePericiaAction DB error:", err);
  }
  redirect("/dashboard/pericias");
}
