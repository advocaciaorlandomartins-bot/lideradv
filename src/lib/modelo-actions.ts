"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import {
  isValidBlocks,
  flattenBlocksToText,
  type Block,
} from "./modelo-blocks";

export type ModeloFormState = { error: string } | null;

/** Lê e valida o campo hidden "conteudo_blocks" (JSON) do formulário. */
function parseBlocksField(formData: FormData): Block[] | null {
  const raw = (formData.get("conteudo_blocks") as string) ?? "";
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return isValidBlocks(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function createModeloAction(
  _prev: ModeloFormState,
  formData: FormData
): Promise<ModeloFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "modelos", "criar"))
    return { error: "Sem permissão." };

  const titulo = ((formData.get("titulo") as string) ?? "").trim();
  const categoria =
    ((formData.get("categoria") as string) ?? "").trim() || null;
  const descricao =
    ((formData.get("descricao") as string) ?? "").trim() || null;
  const usarTimbrado = formData.get("usar_timbrado") === "true";
  const blocks = parseBlocksField(formData);
  const conteudo = blocks
    ? flattenBlocksToText(blocks)
    : ((formData.get("conteudo") as string) ?? "").trim();

  if (!titulo) return { error: "O título é obrigatório." };
  if (!conteudo) return { error: "O conteúdo do modelo é obrigatório." };

  try {
    await sql`
      INSERT INTO modelos_documento (titulo, categoria, descricao, conteudo, conteudo_blocks, usar_timbrado)
      VALUES (${titulo}, ${categoria}, ${descricao}, ${conteudo}, ${blocks ? JSON.stringify(blocks) : null}, ${usarTimbrado})
    `;
  } catch (err) {
    console.error("createModeloAction error:", err);
    return { error: "Erro ao salvar modelo." };
  }

  redirect("/dashboard/modelos");
}

export async function updateModeloAction(
  id: string,
  _prev: ModeloFormState,
  formData: FormData
): Promise<ModeloFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "modelos", "editar"))
    return { error: "Sem permissão." };

  const titulo = ((formData.get("titulo") as string) ?? "").trim();
  const categoria =
    ((formData.get("categoria") as string) ?? "").trim() || null;
  const descricao =
    ((formData.get("descricao") as string) ?? "").trim() || null;
  const ativo = formData.get("ativo") === "true";
  const usarTimbrado = formData.get("usar_timbrado") === "true";
  const blocks = parseBlocksField(formData);
  const conteudo = blocks
    ? flattenBlocksToText(blocks)
    : ((formData.get("conteudo") as string) ?? "").trim();

  if (!titulo) return { error: "O título é obrigatório." };
  if (!conteudo) return { error: "O conteúdo do modelo é obrigatório." };

  try {
    await sql`
      UPDATE modelos_documento SET
        titulo          = ${titulo},
        categoria       = ${categoria},
        descricao       = ${descricao},
        conteudo        = ${conteudo},
        conteudo_blocks = ${blocks ? JSON.stringify(blocks) : null},
        ativo           = ${ativo},
        usar_timbrado   = ${usarTimbrado},
        updated_at      = NOW()
      WHERE id = ${id}::uuid
    `;
  } catch (err) {
    console.error("updateModeloAction error:", err);
    return { error: "Erro ao atualizar modelo." };
  }

  redirect("/dashboard/modelos");
}

export async function deleteModeloAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "modelos", "excluir"))
    return { error: "Sem permissão." };

  try {
    await sql`DELETE FROM modelos_documento WHERE id = ${id}::uuid`;
    revalidatePath("/dashboard/modelos");
    return {};
  } catch (err) {
    console.error("deleteModeloAction error:", err);
    return { error: "Erro ao excluir modelo." };
  }
}

export async function toggleModeloAtivoAction(
  id: string,
  ativo: boolean
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "modelos", "editar"))
    return { error: "Sem permissão." };

  try {
    await sql`
      UPDATE modelos_documento SET ativo = ${ativo}, updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
    revalidatePath("/dashboard/modelos");
    return {};
  } catch (err) {
    console.error("toggleModeloAtivoAction error:", err);
    return { error: "Erro ao atualizar modelo." };
  }
}
