"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sql from "./db";
import { logAction } from "./audit";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { getColaboradorIdForUser } from "./usuarios-db";

export type ColaboradorFormState = { error: string } | null;

function pctField(formData: FormData, name: string): string | null {
  const raw = ((formData.get(name) as string | null) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return !isNaN(n) && n >= 0 && n <= 100 ? String(n) : null;
}

function valorField(formData: FormData, name: string): string | null {
  const raw = ((formData.get(name) as string | null) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  return !isNaN(n) && n > 0 ? String(n) : null;
}

function getFields(formData: FormData) {
  const salarioRaw = (
    (formData.get("salario_mensal") as string | null) ?? ""
  ).trim();
  const status = ((formData.get("status") as string | null) ?? "ativo").trim();
  return {
    nome: ((formData.get("nome") as string | null) ?? "").trim(),
    cargo: ((formData.get("cargo") as string | null) ?? "").trim(),
    email: ((formData.get("email") as string | null) ?? "").trim() || null,
    telefone:
      ((formData.get("telefone") as string | null) ?? "").trim() || null,
    oab: ((formData.get("oab") as string | null) ?? "").trim() || null,
    oabUf:
      ((formData.get("oab_uf") as string | null) ?? "")
        .trim()
        .toUpperCase()
        .slice(0, 2) || null,
    city: ((formData.get("city") as string | null) ?? "").trim() || null,
    salarioMensal: salarioRaw && Number(salarioRaw) > 0 ? salarioRaw : null,
    dataAdmissao: (formData.get("data_admissao") as string | null) || null,
    dataDemissao:
      status === "inativo"
        ? (formData.get("data_demissao") as string | null) || null
        : null,
    status,
    observacoes:
      ((formData.get("observacoes") as string | null) ?? "").trim() || null,
    comissaoAdministrativoPct: pctField(
      formData,
      "comissao_administrativo_pct"
    ),
    comissaoJudicialPct: pctField(formData, "comissao_judicial_pct"),
    comissaoAmbosPct: pctField(formData, "comissao_ambos_pct"),
    meta1Valor: valorField(formData, "meta1_valor"),
    meta1Bonus: valorField(formData, "meta1_bonus"),
    meta2Valor: valorField(formData, "meta2_valor"),
    meta2Bonus: valorField(formData, "meta2_bonus"),
    meta3Valor: valorField(formData, "meta3_valor"),
    meta3Bonus: valorField(formData, "meta3_bonus"),
  };
}

export async function createColaboradorAction(
  _prev: ColaboradorFormState,
  formData: FormData
): Promise<ColaboradorFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "colaboradores", "criar"))
    return { error: "Sem permissão." };

  const f = getFields(formData);

  if (!f.nome) return { error: "Informe o nome do colaborador." };
  if (!f.cargo) return { error: "Selecione o cargo." };

  const salarioValor = (
    (formData.get("salario_valor") as string | null) ?? ""
  ).trim();
  const salarioComp =
    (formData.get("salario_competencia") as string | null) || null;
  const comissaoValor = (
    (formData.get("comissao_valor") as string | null) ?? ""
  ).trim();
  const comissaoComp =
    (formData.get("comissao_competencia") as string | null) || null;
  const comissaoDesc =
    ((formData.get("comissao_descricao") as string | null) ?? "").trim() ||
    null;

  try {
    const rows = await sql`
      INSERT INTO colaboradores (
        nome, cargo, email, telefone, oab, oab_uf, city, salario_mensal, data_admissao,
        data_demissao, status, observacoes,
        comissao_administrativo_pct, comissao_judicial_pct, comissao_ambos_pct,
        meta1_valor, meta1_bonus, meta2_valor, meta2_bonus, meta3_valor, meta3_bonus
      )
      VALUES (
        ${f.nome},
        ${f.cargo},
        ${f.email},
        ${f.telefone},
        ${f.oab},
        ${f.oabUf},
        ${f.city},
        ${f.salarioMensal ? f.salarioMensal : null}::numeric,
        ${f.dataAdmissao ? f.dataAdmissao : null}::date,
        ${f.dataDemissao ? f.dataDemissao : null}::date,
        ${f.status},
        ${f.observacoes},
        ${f.comissaoAdministrativoPct}::numeric,
        ${f.comissaoJudicialPct}::numeric,
        ${f.comissaoAmbosPct}::numeric,
        ${f.meta1Valor}::numeric,
        ${f.meta1Bonus}::numeric,
        ${f.meta2Valor}::numeric,
        ${f.meta2Bonus}::numeric,
        ${f.meta3Valor}::numeric,
        ${f.meta3Bonus}::numeric
      )
      RETURNING id
    `;
    const colaboradorId = rows[0].id as string;

    if (salarioValor && Number(salarioValor) > 0) {
      await sql`
        INSERT INTO remuneracoes (colaborador_id, tipo, valor, competencia, status)
        VALUES (
          ${colaboradorId}::uuid,
          'salario',
          ${salarioValor}::numeric,
          ${salarioComp ? `${salarioComp}-01` : null}::date,
          'pendente'
        )
      `;
    }

    if (comissaoValor && Number(comissaoValor) > 0) {
      await sql`
        INSERT INTO remuneracoes (colaborador_id, tipo, valor, competencia, descricao, status)
        VALUES (
          ${colaboradorId}::uuid,
          'comissao',
          ${comissaoValor}::numeric,
          ${comissaoComp ? `${comissaoComp}-01` : null}::date,
          ${comissaoDesc},
          'pendente'
        )
      `;
    }
  } catch (err) {
    console.error("createColaboradorAction DB error:", err);
    return { error: "Erro ao salvar colaborador. Tente novamente." };
  }

  await logAction({
    acao: "criar",
    entidade: "colaborador",
    descricao: `Cadastrou colaborador: ${f.nome}`,
    detalhes: { cargo: f.cargo },
  });

  redirect("/dashboard/colaboradores");
}

export async function updateColaboradorAction(
  id: string,
  _prev: ColaboradorFormState,
  formData: FormData
): Promise<ColaboradorFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "colaboradores", "editar"))
    return { error: "Sem permissão." };

  const f = getFields(formData);

  if (!f.nome) return { error: "Informe o nome do colaborador." };
  if (!f.cargo) return { error: "Selecione o cargo." };

  try {
    await sql`
      UPDATE colaboradores SET
        nome                         = ${f.nome},
        cargo                        = ${f.cargo},
        email                        = ${f.email},
        telefone                     = ${f.telefone},
        oab                          = ${f.oab},
        oab_uf                       = ${f.oabUf},
        city                         = ${f.city},
        salario_mensal               = ${f.salarioMensal ? f.salarioMensal : null}::numeric,
        data_admissao                = ${f.dataAdmissao ? f.dataAdmissao : null}::date,
        data_demissao                = ${f.dataDemissao ? f.dataDemissao : null}::date,
        status                       = ${f.status},
        observacoes                  = ${f.observacoes},
        comissao_administrativo_pct  = ${f.comissaoAdministrativoPct}::numeric,
        comissao_judicial_pct        = ${f.comissaoJudicialPct}::numeric,
        comissao_ambos_pct           = ${f.comissaoAmbosPct}::numeric,
        meta1_valor                  = ${f.meta1Valor}::numeric,
        meta1_bonus                  = ${f.meta1Bonus}::numeric,
        meta2_valor                  = ${f.meta2Valor}::numeric,
        meta2_bonus                  = ${f.meta2Bonus}::numeric,
        meta3_valor                  = ${f.meta3Valor}::numeric,
        meta3_bonus                  = ${f.meta3Bonus}::numeric,
        updated_at                   = NOW()
      WHERE id = ${id}::uuid
    `;
  } catch (err) {
    console.error("updateColaboradorAction DB error:", err);
    return { error: "Erro ao atualizar colaborador. Tente novamente." };
  }

  await logAction({
    acao: "editar",
    entidade: "colaborador",
    entidadeId: id,
    descricao: `Editou colaborador: ${f.nome}`,
    detalhes: { status: f.status },
  });

  redirect(`/dashboard/colaboradores/${id}`);
}

export async function deleteColaboradorAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "colaboradores", "excluir"))
    return { error: "Sem permissão." };

  try {
    await sql`DELETE FROM colaboradores WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("deleteColaboradorAction DB error:", err);
    return {
      error:
        "Erro ao excluir colaborador. Ele pode ter processos, remunerações ou compromissos vinculados.",
    };
  }
  await logAction({
    acao: "excluir",
    entidade: "colaborador",
    entidadeId: id,
    descricao: "Excluiu colaborador",
  });
  redirect("/dashboard/colaboradores");
}

export type MeusDadosFormState = { error?: string; success?: boolean } | null;

/**
 * Autoatendimento: qualquer colaborador atualiza os PRÓPRIOS dados de
 * contato/endereço, sem precisar de colaboradores:editar (que é
 * administrativo — cargo, salário, comissão, status). O id nunca vem do
 * formulário: é sempre resolvido a partir da sessão, então não tem como
 * essa action mexer no cadastro de outra pessoa mesmo que alguém tente
 * forjar o campo.
 */
export async function updateMeusDadosAction(
  _prev: MeusDadosFormState,
  formData: FormData
): Promise<MeusDadosFormState> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };

  const colaboradorId = await getColaboradorIdForUser(session.id);
  if (!colaboradorId)
    return {
      error: "Seu usuário não está vinculado a um cadastro de colaborador.",
    };

  const telefone =
    ((formData.get("telefone") as string | null) ?? "").trim() || null;
  const email = ((formData.get("email") as string | null) ?? "").trim() || null;
  const cep = ((formData.get("cep") as string | null) ?? "").trim() || null;
  const street =
    ((formData.get("street") as string | null) ?? "").trim() || null;
  const addrNumber =
    ((formData.get("addr_number") as string | null) ?? "").trim() || null;
  const complement =
    ((formData.get("complement") as string | null) ?? "").trim() || null;
  const neighborhood =
    ((formData.get("neighborhood") as string | null) ?? "").trim() || null;
  const city = ((formData.get("city") as string | null) ?? "").trim() || null;
  const state =
    ((formData.get("state") as string | null) ?? "")
      .trim()
      .toUpperCase()
      .slice(0, 2) || null;

  try {
    await sql`
      UPDATE colaboradores SET
        telefone     = ${telefone},
        email        = ${email},
        cep          = ${cep},
        street       = ${street},
        addr_number  = ${addrNumber},
        complement   = ${complement},
        neighborhood = ${neighborhood},
        city         = ${city},
        state        = ${state},
        updated_at   = NOW()
      WHERE id = ${colaboradorId}::uuid
    `;
  } catch (err) {
    console.error("updateMeusDadosAction DB error:", err);
    return { error: "Erro ao salvar. Tente novamente." };
  }

  await logAction({
    acao: "editar",
    entidade: "colaborador",
    entidadeId: colaboradorId,
    descricao: "Atualizou os próprios dados de contato/endereço",
  });

  revalidatePath("/dashboard/meus-dados");
  return { success: true };
}
