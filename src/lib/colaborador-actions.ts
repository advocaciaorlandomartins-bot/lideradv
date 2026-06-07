"use server";

import { redirect } from "next/navigation";
import sql from "./db";
import { logAction } from "./audit";

export type ColaboradorFormState = { error: string } | null;

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
    salarioMensal: salarioRaw && Number(salarioRaw) > 0 ? salarioRaw : null,
    dataAdmissao: (formData.get("data_admissao") as string | null) || null,
    dataDemissao:
      status === "inativo"
        ? (formData.get("data_demissao") as string | null) || null
        : null,
    status,
    observacoes:
      ((formData.get("observacoes") as string | null) ?? "").trim() || null,
  };
}

export async function createColaboradorAction(
  _prev: ColaboradorFormState,
  formData: FormData
): Promise<ColaboradorFormState> {
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
      INSERT INTO colaboradores (nome, cargo, email, telefone, oab, salario_mensal, data_admissao, data_demissao, status, observacoes)
      VALUES (
        ${f.nome},
        ${f.cargo},
        ${f.email},
        ${f.telefone},
        ${f.oab},
        ${f.salarioMensal ? f.salarioMensal : null}::numeric,
        ${f.dataAdmissao ? f.dataAdmissao : null}::date,
        ${f.dataDemissao ? f.dataDemissao : null}::date,
        ${f.status},
        ${f.observacoes}
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
  const f = getFields(formData);

  if (!f.nome) return { error: "Informe o nome do colaborador." };
  if (!f.cargo) return { error: "Selecione o cargo." };

  try {
    await sql`
      UPDATE colaboradores SET
        nome           = ${f.nome},
        cargo          = ${f.cargo},
        email          = ${f.email},
        telefone       = ${f.telefone},
        oab            = ${f.oab},
        salario_mensal = ${f.salarioMensal ? f.salarioMensal : null}::numeric,
        data_admissao  = ${f.dataAdmissao ? f.dataAdmissao : null}::date,
        data_demissao  = ${f.dataDemissao ? f.dataDemissao : null}::date,
        status         = ${f.status},
        observacoes    = ${f.observacoes},
        updated_at     = NOW()
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

export async function deleteColaboradorAction(id: string): Promise<void> {
  try {
    await sql`DELETE FROM colaboradores WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("deleteColaboradorAction DB error:", err);
  }
  await logAction({
    acao: "excluir",
    entidade: "colaborador",
    entidadeId: id,
    descricao: "Excluiu colaborador",
  });
  redirect("/dashboard/colaboradores");
}
