"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";

export type ComissaoConfigFormState =
  | { error: string }
  | { success: true }
  | null;

export async function createComissaoConfigAction(
  _prev: ComissaoConfigFormState,
  formData: FormData
): Promise<ComissaoConfigFormState> {
  const nome = ((formData.get("nome") as string | null) ?? "").trim();
  const tipoOrigem =
    ((formData.get("tipo_origem") as string | null) ?? "").trim() || null;
  const cargoColaborador =
    ((formData.get("cargo_colaborador") as string | null) ?? "").trim() || null;
  const tipoTrabalho =
    ((formData.get("tipo_trabalho") as string | null) ?? "").trim() || null;
  const comissaoTipo =
    ((formData.get("comissao_tipo") as string | null) ?? "").trim() ||
    "percentual";
  const comissaoValorRaw = (
    (formData.get("comissao_valor") as string | null) ?? ""
  ).trim();
  const comissaoValor = comissaoValorRaw ? parseFloat(comissaoValorRaw) : 0;
  const bonificacaoTipo =
    ((formData.get("bonificacao_tipo") as string | null) ?? "").trim() || null;
  const bonificacaoValorRaw = (
    (formData.get("bonificacao_valor") as string | null) ?? ""
  ).trim();
  const bonificacaoValor = bonificacaoValorRaw
    ? parseFloat(bonificacaoValorRaw)
    : null;
  const observacoes =
    ((formData.get("observacoes") as string | null) ?? "").trim() || null;

  if (!nome) return { error: "O nome da regra é obrigatório." };

  try {
    await sql`
      INSERT INTO comissoes_config
        (nome, tipo_origem, cargo_colaborador, tipo_trabalho,
         comissao_tipo, comissao_valor,
         bonificacao_tipo, bonificacao_valor, observacoes)
      VALUES
        (${nome}, ${tipoOrigem}, ${cargoColaborador}, ${tipoTrabalho},
         ${comissaoTipo}, ${comissaoValor},
         ${bonificacaoTipo}, ${bonificacaoValor}, ${observacoes})
    `;
  } catch (err) {
    console.error("createComissaoConfigAction error:", err);
    return { error: "Erro ao salvar regra de comissão." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true };
}

export async function updateComissaoConfigAction(
  id: string,
  _prev: ComissaoConfigFormState,
  formData: FormData
): Promise<ComissaoConfigFormState> {
  const nome = ((formData.get("nome") as string | null) ?? "").trim();
  const tipoOrigem =
    ((formData.get("tipo_origem") as string | null) ?? "").trim() || null;
  const cargoColaborador =
    ((formData.get("cargo_colaborador") as string | null) ?? "").trim() || null;
  const tipoTrabalho =
    ((formData.get("tipo_trabalho") as string | null) ?? "").trim() || null;
  const comissaoTipo =
    ((formData.get("comissao_tipo") as string | null) ?? "").trim() ||
    "percentual";
  const comissaoValorRaw = (
    (formData.get("comissao_valor") as string | null) ?? ""
  ).trim();
  const comissaoValor = comissaoValorRaw ? parseFloat(comissaoValorRaw) : 0;
  const bonificacaoTipo =
    ((formData.get("bonificacao_tipo") as string | null) ?? "").trim() || null;
  const bonificacaoValorRaw = (
    (formData.get("bonificacao_valor") as string | null) ?? ""
  ).trim();
  const bonificacaoValor = bonificacaoValorRaw
    ? parseFloat(bonificacaoValorRaw)
    : null;
  const observacoes =
    ((formData.get("observacoes") as string | null) ?? "").trim() || null;
  const ativo = formData.get("ativo") !== "false";

  if (!nome) return { error: "O nome da regra é obrigatório." };

  try {
    await sql`
      UPDATE comissoes_config SET
        nome               = ${nome},
        tipo_origem        = ${tipoOrigem},
        cargo_colaborador  = ${cargoColaborador},
        tipo_trabalho      = ${tipoTrabalho},
        comissao_tipo      = ${comissaoTipo},
        comissao_valor     = ${comissaoValor},
        bonificacao_tipo   = ${bonificacaoTipo},
        bonificacao_valor  = ${bonificacaoValor},
        observacoes        = ${observacoes},
        ativo              = ${ativo},
        updated_at         = NOW()
      WHERE id = ${id}::uuid
    `;
  } catch (err) {
    console.error("updateComissaoConfigAction error:", err);
    return { error: "Erro ao atualizar regra de comissão." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true };
}

export async function deleteComissaoConfigAction(id: string): Promise<void> {
  try {
    await sql`DELETE FROM comissoes_config WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("deleteComissaoConfigAction error:", err);
  }
  revalidatePath("/dashboard/configuracoes");
}

export async function toggleComissaoConfigAtivoAction(
  id: string,
  ativo: boolean
): Promise<void> {
  try {
    await sql`UPDATE comissoes_config SET ativo = ${!ativo}, updated_at = NOW() WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("toggleComissaoConfigAtivoAction error:", err);
  }
  revalidatePath("/dashboard/configuracoes");
}
