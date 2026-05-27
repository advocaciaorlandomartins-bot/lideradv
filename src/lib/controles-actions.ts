"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";

export type ControleFormState = { error?: string; success?: boolean } | null;

export async function createControleAction(
  _prev: ControleFormState,
  formData: FormData
): Promise<ControleFormState> {
  const tipo = (formData.get("tipo") as string) ?? "";
  const dataEvento =
    ((formData.get("data_evento") as string) ?? "").trim() || null;
  const descricao = ((formData.get("descricao") as string) ?? "").trim();
  const clienteId =
    ((formData.get("cliente_id") as string) ?? "").trim() || null;
  const processoId =
    ((formData.get("processo_id") as string) ?? "").trim() || null;
  const responsavelId =
    ((formData.get("responsavel_id") as string) ?? "").trim() || null;
  const tipoDemanda =
    ((formData.get("tipo_demanda") as string) ?? "").trim() || null;
  const observacoes =
    ((formData.get("observacoes") as string) ?? "").trim() || null;

  if (!tipo) return { error: "Tipo de controle obrigatório." };
  if (!descricao) return { error: "Descrição é obrigatória." };

  try {
    if (clienteId && processoId && responsavelId) {
      await sql`
        INSERT INTO controles (tipo, data_evento, descricao, cliente_id, processo_id, responsavel_id, tipo_demanda, observacoes)
        VALUES (${tipo}, ${dataEvento}::date, ${descricao}, ${clienteId}::uuid, ${processoId}::uuid, ${responsavelId}::uuid, ${tipoDemanda}, ${observacoes})
      `;
    } else if (clienteId && processoId) {
      await sql`
        INSERT INTO controles (tipo, data_evento, descricao, cliente_id, processo_id, tipo_demanda, observacoes)
        VALUES (${tipo}, ${dataEvento}::date, ${descricao}, ${clienteId}::uuid, ${processoId}::uuid, ${tipoDemanda}, ${observacoes})
      `;
    } else if (clienteId && responsavelId) {
      await sql`
        INSERT INTO controles (tipo, data_evento, descricao, cliente_id, responsavel_id, tipo_demanda, observacoes)
        VALUES (${tipo}, ${dataEvento}::date, ${descricao}, ${clienteId}::uuid, ${responsavelId}::uuid, ${tipoDemanda}, ${observacoes})
      `;
    } else if (clienteId) {
      await sql`
        INSERT INTO controles (tipo, data_evento, descricao, cliente_id, tipo_demanda, observacoes)
        VALUES (${tipo}, ${dataEvento}::date, ${descricao}, ${clienteId}::uuid, ${tipoDemanda}, ${observacoes})
      `;
    } else {
      await sql`
        INSERT INTO controles (tipo, data_evento, descricao, tipo_demanda, observacoes)
        VALUES (${tipo}, ${dataEvento}::date, ${descricao}, ${tipoDemanda}, ${observacoes})
      `;
    }
  } catch (err) {
    console.error("createControleAction:", err);
    return { error: "Erro ao criar controle." };
  }

  revalidatePath("/dashboard/controles");
  return { success: true };
}

export async function updateControleAction(
  _prev: ControleFormState,
  formData: FormData
): Promise<ControleFormState> {
  const id = (formData.get("id") as string) ?? "";
  const tipo = (formData.get("tipo") as string) ?? "";
  const dataEvento =
    ((formData.get("data_evento") as string) ?? "").trim() || null;
  const descricao = ((formData.get("descricao") as string) ?? "").trim();
  const status = ((formData.get("status") as string) ?? "").trim() || null;
  const clienteId =
    ((formData.get("cliente_id") as string) ?? "").trim() || null;
  const processoId =
    ((formData.get("processo_id") as string) ?? "").trim() || null;
  const responsavelId =
    ((formData.get("responsavel_id") as string) ?? "").trim() || null;
  const tipoDemanda =
    ((formData.get("tipo_demanda") as string) ?? "").trim() || null;
  const observacoes =
    ((formData.get("observacoes") as string) ?? "").trim() || null;

  if (!id) return { error: "ID inválido." };
  if (!tipo) return { error: "Tipo obrigatório." };
  if (!descricao) return { error: "Descrição é obrigatória." };

  // status: 'pendente' → NULL in DB, others stored as-is
  const dbStatus = status === "pendente" || !status ? null : status;

  try {
    if (clienteId && processoId && responsavelId) {
      await sql`
        UPDATE controles SET
          tipo = ${tipo}, data_evento = ${dataEvento}::date, descricao = ${descricao},
          status = ${dbStatus}, cliente_id = ${clienteId}::uuid,
          processo_id = ${processoId}::uuid, responsavel_id = ${responsavelId}::uuid,
          tipo_demanda = ${tipoDemanda}, observacoes = ${observacoes}, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    } else if (clienteId && processoId) {
      await sql`
        UPDATE controles SET
          tipo = ${tipo}, data_evento = ${dataEvento}::date, descricao = ${descricao},
          status = ${dbStatus}, cliente_id = ${clienteId}::uuid,
          processo_id = ${processoId}::uuid, responsavel_id = NULL,
          tipo_demanda = ${tipoDemanda}, observacoes = ${observacoes}, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    } else if (clienteId) {
      await sql`
        UPDATE controles SET
          tipo = ${tipo}, data_evento = ${dataEvento}::date, descricao = ${descricao},
          status = ${dbStatus}, cliente_id = ${clienteId}::uuid,
          processo_id = NULL, responsavel_id = NULL,
          tipo_demanda = ${tipoDemanda}, observacoes = ${observacoes}, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    } else {
      await sql`
        UPDATE controles SET
          tipo = ${tipo}, data_evento = ${dataEvento}::date, descricao = ${descricao},
          status = ${dbStatus}, cliente_id = NULL, processo_id = NULL, responsavel_id = NULL,
          tipo_demanda = ${tipoDemanda}, observacoes = ${observacoes}, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
    }
  } catch (err) {
    console.error("updateControleAction:", err);
    return { error: "Erro ao atualizar controle." };
  }

  revalidatePath("/dashboard/controles");
  return { success: true };
}

export async function updateStatusControleAction(
  id: string,
  novoStatus: "concluido" | "cancelado" | "pendente"
): Promise<void> {
  const dbStatus = novoStatus === "pendente" ? null : novoStatus;
  await sql`UPDATE controles SET status = ${dbStatus}, updated_at = NOW() WHERE id = ${id}::uuid`;
  revalidatePath("/dashboard/controles");
}

export async function deleteControleAction(id: string): Promise<void> {
  await sql`DELETE FROM controles WHERE id = ${id}::uuid`;
  revalidatePath("/dashboard/controles");
}
