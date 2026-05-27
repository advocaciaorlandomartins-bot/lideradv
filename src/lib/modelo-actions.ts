"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import sql from "./db";

export type ModeloFormState = { error: string } | null;

export async function createModeloAction(
  _prev: ModeloFormState,
  formData: FormData
): Promise<ModeloFormState> {
  const titulo = ((formData.get("titulo") as string) ?? "").trim();
  const categoria =
    ((formData.get("categoria") as string) ?? "").trim() || null;
  const descricao =
    ((formData.get("descricao") as string) ?? "").trim() || null;
  const conteudo = ((formData.get("conteudo") as string) ?? "").trim();
  const usarTimbrado = formData.get("usar_timbrado") === "true";

  if (!titulo) return { error: "O título é obrigatório." };
  if (!conteudo) return { error: "O conteúdo do modelo é obrigatório." };

  try {
    await sql`
      INSERT INTO modelos_documento (titulo, categoria, descricao, conteudo, usar_timbrado)
      VALUES (${titulo}, ${categoria}, ${descricao}, ${conteudo}, ${usarTimbrado})
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
  const titulo = ((formData.get("titulo") as string) ?? "").trim();
  const categoria =
    ((formData.get("categoria") as string) ?? "").trim() || null;
  const descricao =
    ((formData.get("descricao") as string) ?? "").trim() || null;
  const conteudo = ((formData.get("conteudo") as string) ?? "").trim();
  const ativo = formData.get("ativo") === "true";
  const usarTimbrado = formData.get("usar_timbrado") === "true";

  if (!titulo) return { error: "O título é obrigatório." };
  if (!conteudo) return { error: "O conteúdo do modelo é obrigatório." };

  try {
    await sql`
      UPDATE modelos_documento SET
        titulo         = ${titulo},
        categoria      = ${categoria},
        descricao      = ${descricao},
        conteudo       = ${conteudo},
        ativo          = ${ativo},
        usar_timbrado  = ${usarTimbrado},
        updated_at     = NOW()
      WHERE id = ${id}::uuid
    `;
  } catch (err) {
    console.error("updateModeloAction error:", err);
    return { error: "Erro ao atualizar modelo." };
  }

  redirect("/dashboard/modelos");
}

export async function deleteModeloAction(id: string): Promise<void> {
  try {
    await sql`DELETE FROM modelos_documento WHERE id = ${id}::uuid`;
    revalidatePath("/dashboard/modelos");
  } catch (err) {
    console.error("deleteModeloAction error:", err);
  }
}

export async function toggleModeloAtivoAction(
  id: string,
  ativo: boolean
): Promise<void> {
  try {
    await sql`
      UPDATE modelos_documento SET ativo = ${ativo}, updated_at = NOW()
      WHERE id = ${id}::uuid
    `;
    revalidatePath("/dashboard/modelos");
  } catch (err) {
    console.error("toggleModeloAtivoAction error:", err);
  }
}
