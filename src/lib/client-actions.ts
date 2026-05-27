"use server";

import { redirect } from "next/navigation";
import sql from "./db";

export type ClientFormState = { error: string } | null;

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const type = formData.get("type") as string;
  const name = ((formData.get("name") as string | null) ?? "").trim();
  const doc = ((formData.get("doc") as string | null) ?? "").trim();
  const tradeName =
    ((formData.get("trade_name") as string | null) ?? "").trim() || null;
  const birthDate = (formData.get("birth_date") as string | null) || null;
  const email = ((formData.get("email") as string | null) ?? "").trim();
  const phone = ((formData.get("phone") as string | null) ?? "").trim();
  const cep = ((formData.get("cep") as string | null) ?? "").trim();
  const street = ((formData.get("street") as string | null) ?? "").trim();
  const addrNumber = ((formData.get("number") as string | null) ?? "").trim();
  const complement =
    ((formData.get("complement") as string | null) ?? "").trim() || null;
  const neighborhood = (
    (formData.get("neighborhood") as string | null) ?? ""
  ).trim();
  const city = ((formData.get("city") as string | null) ?? "").trim();
  const state = formData.get("state") as string;
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;
  const rg = ((formData.get("rg") as string | null) ?? "").trim() || null;
  const rgOrgao =
    ((formData.get("rg_orgao") as string | null) ?? "").trim() || null;
  const estadoCivil =
    ((formData.get("estado_civil") as string | null) ?? "").trim() || null;
  const genero =
    ((formData.get("genero") as string | null) ?? "").trim() || null;
  const profissao =
    ((formData.get("profissao") as string | null) ?? "").trim() || null;
  const nacionalidade =
    ((formData.get("nacionalidade") as string | null) ?? "").trim() || null;
  const senhaCliente =
    ((formData.get("senha_cliente") as string | null) ?? "").trim() || null;
  const parceria =
    ((formData.get("parceria") as string | null) ?? "").trim() || null;
  const menorIncapaz = formData.get("menor_incapaz") === "true";
  const responsavelNome =
    ((formData.get("responsavel_nome") as string | null) ?? "").trim() || null;
  const responsavelCpf =
    ((formData.get("responsavel_cpf") as string | null) ?? "").trim() || null;
  const responsavelRg =
    ((formData.get("responsavel_rg") as string | null) ?? "").trim() || null;
  const responsavelRgOrgao =
    ((formData.get("responsavel_rg_orgao") as string | null) ?? "").trim() ||
    null;
  const responsavelTelefone =
    ((formData.get("responsavel_telefone") as string | null) ?? "").trim() ||
    null;
  const responsavelEmail =
    ((formData.get("responsavel_email") as string | null) ?? "").trim() || null;
  const responsavelParentesco =
    ((formData.get("responsavel_parentesco") as string | null) ?? "").trim() ||
    null;

  if (!type || !name || !doc || !email || !phone) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  if (!cep || !street || !addrNumber || !neighborhood || !city || !state) {
    return { error: "Preencha o endereço completo." };
  }

  try {
    await sql`
      INSERT INTO clients
        (type, name, doc, trade_name, birth_date, email, phone,
         rg, rg_orgao, estado_civil, genero, profissao, nacionalidade,
         senha_cliente, parceria,
         menor_incapaz, responsavel_nome, responsavel_cpf, responsavel_rg,
         responsavel_rg_orgao, responsavel_telefone, responsavel_email,
         responsavel_parentesco,
         cep, street, addr_number, complement, neighborhood,
         city, state, notes)
      VALUES
        (${type}, ${name}, ${doc}, ${tradeName},
         ${birthDate ? birthDate : null}::date,
         ${email}, ${phone},
         ${rg}, ${rgOrgao}, ${estadoCivil}, ${genero}, ${profissao},
         ${nacionalidade}, ${senhaCliente}, ${parceria},
         ${menorIncapaz}, ${responsavelNome}, ${responsavelCpf}, ${responsavelRg},
         ${responsavelRgOrgao}, ${responsavelTelefone}, ${responsavelEmail},
         ${responsavelParentesco},
         ${cep}, ${street}, ${addrNumber},
         ${complement}, ${neighborhood}, ${city}, ${state}, ${notes})
    `;
  } catch (err) {
    console.error("createClientAction DB error:", err);
    return { error: "Erro ao salvar cliente. Tente novamente." };
  }

  redirect("/dashboard/clientes");
}

export async function updateClientAction(
  id: string,
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const type = formData.get("type") as string;
  const name = ((formData.get("name") as string | null) ?? "").trim();
  const doc = ((formData.get("doc") as string | null) ?? "").trim();
  const tradeName =
    ((formData.get("trade_name") as string | null) ?? "").trim() || null;
  const birthDate = (formData.get("birth_date") as string | null) || null;
  const email = ((formData.get("email") as string | null) ?? "").trim();
  const phone = ((formData.get("phone") as string | null) ?? "").trim();
  const cep = ((formData.get("cep") as string | null) ?? "").trim();
  const street = ((formData.get("street") as string | null) ?? "").trim();
  const addrNumber = ((formData.get("number") as string | null) ?? "").trim();
  const complement =
    ((formData.get("complement") as string | null) ?? "").trim() || null;
  const neighborhood = (
    (formData.get("neighborhood") as string | null) ?? ""
  ).trim();
  const city = ((formData.get("city") as string | null) ?? "").trim();
  const state = formData.get("state") as string;
  const notes = ((formData.get("notes") as string | null) ?? "").trim() || null;
  const status = (formData.get("status") as string) || "ativo";
  const rg = ((formData.get("rg") as string | null) ?? "").trim() || null;
  const rgOrgao =
    ((formData.get("rg_orgao") as string | null) ?? "").trim() || null;
  const estadoCivil =
    ((formData.get("estado_civil") as string | null) ?? "").trim() || null;
  const genero =
    ((formData.get("genero") as string | null) ?? "").trim() || null;
  const profissao =
    ((formData.get("profissao") as string | null) ?? "").trim() || null;
  const nacionalidade =
    ((formData.get("nacionalidade") as string | null) ?? "").trim() || null;
  const senhaCliente =
    ((formData.get("senha_cliente") as string | null) ?? "").trim() || null;
  const parceria =
    ((formData.get("parceria") as string | null) ?? "").trim() || null;
  const menorIncapaz = formData.get("menor_incapaz") === "true";
  const responsavelNome =
    ((formData.get("responsavel_nome") as string | null) ?? "").trim() || null;
  const responsavelCpf =
    ((formData.get("responsavel_cpf") as string | null) ?? "").trim() || null;
  const responsavelRg =
    ((formData.get("responsavel_rg") as string | null) ?? "").trim() || null;
  const responsavelRgOrgao =
    ((formData.get("responsavel_rg_orgao") as string | null) ?? "").trim() ||
    null;
  const responsavelTelefone =
    ((formData.get("responsavel_telefone") as string | null) ?? "").trim() ||
    null;
  const responsavelEmail =
    ((formData.get("responsavel_email") as string | null) ?? "").trim() || null;
  const responsavelParentesco =
    ((formData.get("responsavel_parentesco") as string | null) ?? "").trim() ||
    null;

  if (!type || !name || !doc || !email || !phone) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  if (!cep || !street || !addrNumber || !neighborhood || !city || !state) {
    return { error: "Preencha o endereço completo." };
  }

  try {
    await sql`
      UPDATE clients SET
        type                  = ${type},
        name                  = ${name},
        doc                   = ${doc},
        trade_name            = ${tradeName},
        birth_date            = ${birthDate ? birthDate : null}::date,
        email                 = ${email},
        phone                 = ${phone},
        rg                    = ${rg},
        rg_orgao              = ${rgOrgao},
        estado_civil          = ${estadoCivil},
        genero                = ${genero},
        profissao             = ${profissao},
        nacionalidade         = ${nacionalidade},
        senha_cliente         = ${senhaCliente},
        parceria              = ${parceria},
        menor_incapaz         = ${menorIncapaz},
        responsavel_nome      = ${responsavelNome},
        responsavel_cpf       = ${responsavelCpf},
        responsavel_rg        = ${responsavelRg},
        responsavel_rg_orgao  = ${responsavelRgOrgao},
        responsavel_telefone  = ${responsavelTelefone},
        responsavel_email     = ${responsavelEmail},
        responsavel_parentesco = ${responsavelParentesco},
        cep                   = ${cep},
        street                = ${street},
        addr_number           = ${addrNumber},
        complement            = ${complement},
        neighborhood          = ${neighborhood},
        city                  = ${city},
        state                 = ${state},
        notes                 = ${notes},
        status                = ${status}
      WHERE id = ${id}::uuid
    `;
  } catch (err) {
    console.error("updateClientAction DB error:", err);
    return { error: "Erro ao atualizar cliente. Tente novamente." };
  }

  redirect(`/dashboard/clientes/${id}`);
}

export async function deleteClientAction(id: string): Promise<void> {
  try {
    await sql`DELETE FROM clients WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("deleteClientAction DB error:", err);
    return;
  }
  redirect("/dashboard/clientes");
}
