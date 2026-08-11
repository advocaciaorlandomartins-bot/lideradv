"use server";

import { revalidatePath } from "next/cache";
import sql from "./db";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";

export type ConfigFormState = { error?: string; success?: boolean } | null;

export async function saveEscritorioConfigAction(
  _prev: ConfigFormState,
  formData: FormData
): Promise<ConfigFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "configuracoes", "editar"))
    return { error: "Sem permissão." };

  const nome = ((formData.get("nome") as string) ?? "").trim();
  const oab = ((formData.get("oab") as string) ?? "").trim() || null;
  const cnpj = ((formData.get("cnpj") as string) ?? "").trim() || null;
  const telefone = ((formData.get("telefone") as string) ?? "").trim() || null;
  const email = ((formData.get("email") as string) ?? "").trim() || null;
  const site = ((formData.get("site") as string) ?? "").trim() || null;
  const endereco = ((formData.get("endereco") as string) ?? "").trim() || null;
  const cidade = ((formData.get("cidade") as string) ?? "").trim() || null;
  const estado = ((formData.get("estado") as string) ?? "").trim() || null;
  const cep = ((formData.get("cep") as string) ?? "").trim() || null;
  const logoUrl = ((formData.get("logo_url") as string) ?? "").trim() || null;
  const logoAtivo = formData.get("logo_ativo") !== "false";

  // Typography & layout
  const fontPadrao = (
    (formData.get("font_padrao") as string) ?? "Times"
  ).trim();
  const tamanhoPadrao =
    parseFloat((formData.get("tamanho_padrao") as string) ?? "12") || 12;
  const lineHeight =
    parseFloat((formData.get("line_height") as string) ?? "1.8") || 1.8;
  const margemTopo =
    parseFloat((formData.get("margem_topo") as string) ?? "25") || 25;
  const margemDireita =
    parseFloat((formData.get("margem_direita") as string) ?? "25") || 25;
  const margemInferior =
    parseFloat((formData.get("margem_inferior") as string) ?? "28") || 28;
  const margemEsquerda =
    parseFloat((formData.get("margem_esquerda") as string) ?? "25") || 25;
  const modeloTimbrado =
    ((formData.get("modelo_timbrado") as string) ?? "classico").trim() ||
    "classico";
  const modeloTimbradoAtivo = formData.get("modelo_timbrado_ativo") !== "false";
  const fundoTimbrado =
    ((formData.get("fundo_timbrado") as string) ?? "").trim() || null;
  const fundoTimbradoAtivo = formData.get("fundo_timbrado_ativo") !== "false";
  const salarioMinimo =
    parseFloat(
      ((formData.get("salario_minimo") as string) ?? "")
        .replace(/\./g, "")
        .replace(",", ".")
    ) || 1518.0;

  if (!nome) return { error: "O nome do escritório é obrigatório." };

  try {
    const existing = await sql`SELECT id FROM escritorio_config LIMIT 1`;
    if (existing.length > 0) {
      await sql`
        UPDATE escritorio_config SET
          nome = ${nome}, oab = ${oab}, cnpj = ${cnpj},
          telefone = ${telefone}, email = ${email}, site = ${site},
          endereco = ${endereco}, cidade = ${cidade}, estado = ${estado},
          cep = ${cep}, logo_url = ${logoUrl}, logo_ativo = ${logoAtivo},
          font_padrao = ${fontPadrao}, tamanho_padrao = ${tamanhoPadrao},
          line_height = ${lineHeight}, margem_topo = ${margemTopo},
          margem_direita = ${margemDireita}, margem_inferior = ${margemInferior},
          margem_esquerda = ${margemEsquerda}, modelo_timbrado = ${modeloTimbrado},
          modelo_timbrado_ativo = ${modeloTimbradoAtivo},
          fundo_timbrado = ${fundoTimbrado},
          fundo_timbrado_ativo = ${fundoTimbradoAtivo},
          salario_minimo = ${salarioMinimo},
          updated_at = NOW()
        WHERE id = ${existing[0].id}::uuid
      `;
    } else {
      await sql`
        INSERT INTO escritorio_config
          (nome, oab, cnpj, telefone, email, site, endereco, cidade, estado, cep,
           logo_url, logo_ativo, font_padrao, tamanho_padrao, line_height,
           margem_topo, margem_direita, margem_inferior, margem_esquerda,
           modelo_timbrado, modelo_timbrado_ativo,
           fundo_timbrado, fundo_timbrado_ativo, salario_minimo)
        VALUES
          (${nome}, ${oab}, ${cnpj}, ${telefone}, ${email}, ${site},
           ${endereco}, ${cidade}, ${estado}, ${cep}, ${logoUrl}, ${logoAtivo},
           ${fontPadrao}, ${tamanhoPadrao}, ${lineHeight},
           ${margemTopo}, ${margemDireita}, ${margemInferior}, ${margemEsquerda},
           ${modeloTimbrado}, ${modeloTimbradoAtivo},
           ${fundoTimbrado}, ${fundoTimbradoAtivo}, ${salarioMinimo})
      `;
    }
  } catch (err) {
    console.error("saveEscritorioConfigAction error:", err);
    return { error: "Erro ao salvar configurações." };
  }

  revalidatePath("/dashboard/configuracoes");
  return { success: true };
}
