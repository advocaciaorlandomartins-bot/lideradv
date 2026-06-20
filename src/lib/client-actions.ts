"use server";

import { redirect } from "next/navigation";
import sql from "./db";
import { logAction } from "./audit";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";

export type ClientFormState = { error: string } | null;

export async function createClientAction(
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "criar"))
    return { error: "Sem permissão." };

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
  const origemTipo =
    ((formData.get("origem_tipo") as string | null) ?? "").trim() || null;
  const origemTexto =
    ((formData.get("origem_texto") as string | null) ?? "").trim() || null;
  const indicadorId =
    ((formData.get("indicador_id") as string | null) ?? "").trim() || null;
  const indicadorTipoTrabalho =
    ((formData.get("indicador_tipo_trabalho") as string | null) ?? "").trim() ||
    null;
  const comissaoTipo =
    ((formData.get("comissao_tipo") as string | null) ?? "").trim() || null;
  const comissaoValorRaw = (
    (formData.get("comissao_valor") as string | null) ?? ""
  ).trim();
  const comissaoValor = comissaoValorRaw ? comissaoValorRaw : null;
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

  if (!type || !name || !doc || !phone) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  {
    const missingAddr: string[] = [];
    if (!cep) missingAddr.push("CEP");
    if (!street) missingAddr.push("logradouro");
    if (!addrNumber) missingAddr.push("número");
    if (!neighborhood) missingAddr.push("bairro");
    if (!city) missingAddr.push("cidade");
    if (!state) missingAddr.push("estado");
    if (missingAddr.length > 0) {
      return {
        error: `Preencha os campos de endereço: ${missingAddr.join(", ")}.`,
      };
    }
  }

  try {
    await sql`
      INSERT INTO clients
        (type, name, doc, trade_name, birth_date, email, phone,
         rg, rg_orgao, estado_civil, genero, profissao, nacionalidade,
         senha_cliente,
         origem_tipo, origem_texto, indicador_id, indicador_tipo_trabalho,
         comissao_tipo, comissao_valor,
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
         ${nacionalidade}, ${senhaCliente},
         ${origemTipo}, ${origemTexto}, ${indicadorId}::uuid,
         ${indicadorTipoTrabalho}, ${comissaoTipo}, ${comissaoValor},
         ${menorIncapaz}, ${responsavelNome}, ${responsavelCpf}, ${responsavelRg},
         ${responsavelRgOrgao}, ${responsavelTelefone}, ${responsavelEmail},
         ${responsavelParentesco},
         ${cep}, ${street}, ${addrNumber},
         ${complement}, ${neighborhood}, ${city}, ${state}, ${notes})
    `;
  } catch (err: unknown) {
    // If new origin columns don't exist yet, fall back to insert without them
    const code = (err as { code?: string }).code;
    if (code === "42703") {
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
             ${nacionalidade}, ${senhaCliente}, ${origemTipo},
             ${menorIncapaz}, ${responsavelNome}, ${responsavelCpf}, ${responsavelRg},
             ${responsavelRgOrgao}, ${responsavelTelefone}, ${responsavelEmail},
             ${responsavelParentesco},
             ${cep}, ${street}, ${addrNumber},
             ${complement}, ${neighborhood}, ${city}, ${state}, ${notes})
        `;
      } catch (fallbackErr) {
        console.error("createClientAction fallback DB error:", fallbackErr);
        return { error: "Erro ao salvar cliente. Tente novamente." };
      }
    } else {
      console.error("createClientAction DB error:", err);
      return { error: "Erro ao salvar cliente. Tente novamente." };
    }
  }

  await logAction({
    acao: "criar",
    entidade: "cliente",
    descricao: `Cadastrou cliente: ${name}`,
    detalhes: { type, doc },
  });

  redirect("/dashboard/clientes");
}

export async function updateClientAction(
  id: string,
  _prev: ClientFormState,
  formData: FormData
): Promise<ClientFormState> {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "editar"))
    return { error: "Sem permissão." };

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
  const origemTipo =
    ((formData.get("origem_tipo") as string | null) ?? "").trim() || null;
  const origemTexto =
    ((formData.get("origem_texto") as string | null) ?? "").trim() || null;
  const indicadorId =
    ((formData.get("indicador_id") as string | null) ?? "").trim() || null;
  const indicadorTipoTrabalho =
    ((formData.get("indicador_tipo_trabalho") as string | null) ?? "").trim() ||
    null;
  const comissaoTipo =
    ((formData.get("comissao_tipo") as string | null) ?? "").trim() || null;
  const comissaoValorRaw = (
    (formData.get("comissao_valor") as string | null) ?? ""
  ).trim();
  const comissaoValor = comissaoValorRaw ? comissaoValorRaw : null;
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

  if (!type || !name || !doc || !phone) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  {
    const missingAddr: string[] = [];
    if (!cep) missingAddr.push("CEP");
    if (!street) missingAddr.push("logradouro");
    if (!addrNumber) missingAddr.push("número");
    if (!neighborhood) missingAddr.push("bairro");
    if (!city) missingAddr.push("cidade");
    if (!state) missingAddr.push("estado");
    if (missingAddr.length > 0) {
      return {
        error: `Preencha os campos de endereço: ${missingAddr.join(", ")}.`,
      };
    }
  }

  try {
    await sql`
      UPDATE clients SET
        type                    = ${type},
        name                    = ${name},
        doc                     = ${doc},
        trade_name              = ${tradeName},
        birth_date              = ${birthDate ? birthDate : null}::date,
        email                   = ${email},
        phone                   = ${phone},
        rg                      = ${rg},
        rg_orgao                = ${rgOrgao},
        estado_civil            = ${estadoCivil},
        genero                  = ${genero},
        profissao               = ${profissao},
        nacionalidade           = ${nacionalidade},
        senha_cliente           = ${senhaCliente},
        origem_tipo             = ${origemTipo},
        origem_texto            = ${origemTexto},
        indicador_id            = ${indicadorId}::uuid,
        indicador_tipo_trabalho = ${indicadorTipoTrabalho},
        comissao_tipo           = ${comissaoTipo},
        comissao_valor          = ${comissaoValor},
        menor_incapaz           = ${menorIncapaz},
        responsavel_nome        = ${responsavelNome},
        responsavel_cpf         = ${responsavelCpf},
        responsavel_rg          = ${responsavelRg},
        responsavel_rg_orgao    = ${responsavelRgOrgao},
        responsavel_telefone    = ${responsavelTelefone},
        responsavel_email       = ${responsavelEmail},
        responsavel_parentesco  = ${responsavelParentesco},
        cep                     = ${cep},
        street                  = ${street},
        addr_number             = ${addrNumber},
        complement              = ${complement},
        neighborhood            = ${neighborhood},
        city                    = ${city},
        state                   = ${state},
        notes                   = ${notes},
        status                  = ${status}
      WHERE id = ${id}::uuid
    `;
  } catch (err: unknown) {
    // If new origin columns don't exist yet, fall back to update without them
    const code = (err as { code?: string }).code;
    if (code === "42703") {
      try {
        await sql`
          UPDATE clients SET
            type                   = ${type},
            name                   = ${name},
            doc                    = ${doc},
            trade_name             = ${tradeName},
            birth_date             = ${birthDate ? birthDate : null}::date,
            email                  = ${email},
            phone                  = ${phone},
            rg                     = ${rg},
            rg_orgao               = ${rgOrgao},
            estado_civil           = ${estadoCivil},
            genero                 = ${genero},
            profissao              = ${profissao},
            nacionalidade          = ${nacionalidade},
            senha_cliente          = ${senhaCliente},
            parceria               = ${origemTipo},
            menor_incapaz          = ${menorIncapaz},
            responsavel_nome       = ${responsavelNome},
            responsavel_cpf        = ${responsavelCpf},
            responsavel_rg         = ${responsavelRg},
            responsavel_rg_orgao   = ${responsavelRgOrgao},
            responsavel_telefone   = ${responsavelTelefone},
            responsavel_email      = ${responsavelEmail},
            responsavel_parentesco = ${responsavelParentesco},
            cep                    = ${cep},
            street                 = ${street},
            addr_number            = ${addrNumber},
            complement             = ${complement},
            neighborhood           = ${neighborhood},
            city                   = ${city},
            state                  = ${state},
            notes                  = ${notes},
            status                 = ${status}
          WHERE id = ${id}::uuid
        `;
      } catch (fallbackErr) {
        console.error("updateClientAction fallback DB error:", fallbackErr);
        return { error: "Erro ao atualizar cliente. Tente novamente." };
      }
    } else {
      console.error("updateClientAction DB error:", err);
      return { error: "Erro ao atualizar cliente. Tente novamente." };
    }
  }

  await logAction({
    acao: "editar",
    entidade: "cliente",
    entidadeId: id,
    descricao: `Editou cliente: ${name}`,
  });

  redirect(`/dashboard/clientes/${id}`);
}

export async function deleteClientAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "excluir")) {
    return { error: "Sem permissão para excluir clientes." };
  }

  try {
    await sql`DELETE FROM clients WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("deleteClientAction DB error:", err);
    return {
      error: "Erro ao excluir cliente. Verifique se ele não possui vínculos.",
    };
  }

  try {
    await logAction({
      acao: "excluir",
      entidade: "cliente",
      entidadeId: id,
      descricao: "Excluiu cliente",
    });
  } catch {
    // log failure is non-critical
  }

  return {};
}
