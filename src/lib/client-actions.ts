"use server";

import { redirect } from "next/navigation";
import sql from "./db";
import { logAction } from "./audit";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";
import { notificarPrevBot } from "./prevbot-outbound";

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

  // Campos previdenciários
  const nis =
    ((formData.get("nis") as string | null) ?? "").replace(/\D/g, "") || null;
  const numBeneficio =
    ((formData.get("num_beneficio") as string | null) ?? "").trim() || null;
  const statusBeneficio =
    ((formData.get("status_beneficio") as string | null) ?? "").trim() || null;
  const tipoBeneficio =
    ((formData.get("tipo_beneficio") as string | null) ?? "").trim() || null;
  const dataInicioBeneficio =
    (formData.get("data_inicio_beneficio") as string | null) || null;
  const valorBeneficioRaw =
    ((formData.get("valor_beneficio") as string | null) ?? "")
      .replace(/\./g, "")
      .replace(",", ".") || null;
  const valorBeneficio = valorBeneficioRaw ? valorBeneficioRaw : null;
  const categoriaContribuinte =
    ((formData.get("categoria_contribuinte") as string | null) ?? "").trim() ||
    null;
  const carenciaAtingida =
    formData.get("carencia_atingida") === "true"
      ? true
      : formData.get("carencia_atingida") === "false"
        ? false
        : null;
  const cidPrincipal =
    ((formData.get("cid_principal") as string | null) ?? "")
      .trim()
      .toUpperCase() || null;
  const tipoIncapacidade =
    ((formData.get("tipo_incapacidade") as string | null) ?? "").trim() || null;
  const dataDiagnostico =
    (formData.get("data_diagnostico") as string | null) || null;
  const naturalidadeCidade =
    ((formData.get("naturalidade_cidade") as string | null) ?? "").trim() ||
    null;
  const naturalidadeEstado =
    ((formData.get("naturalidade_estado") as string | null) ?? "").trim() ||
    null;
  const filiacaoMae =
    ((formData.get("filiacao_mae") as string | null) ?? "").trim() || null;
  const filiacaoPai =
    ((formData.get("filiacao_pai") as string | null) ?? "").trim() || null;
  const dataAfastamento =
    (formData.get("data_afastamento") as string | null) || null;
  const atividadeAnterior =
    ((formData.get("atividade_anterior") as string | null) ?? "").trim() ||
    null;
  const numContribuicoesRaw = (
    (formData.get("num_contribuicoes") as string | null) ?? ""
  ).trim();
  const numContribuicoes = numContribuicoesRaw
    ? parseInt(numContribuicoesRaw, 10)
    : null;

  if (!type || !name || !doc) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  if (email) {
    const dup =
      await sql`SELECT id FROM clients WHERE email = ${email} AND deleted_at IS NULL LIMIT 1`;
    if (dup.length > 0)
      return { error: "Este e-mail já está cadastrado em outro cliente." };
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
         city, state, notes,
         nis, num_beneficio, status_beneficio, tipo_beneficio,
         data_inicio_beneficio, valor_beneficio, categoria_contribuinte,
         carencia_atingida, cid_principal, tipo_incapacidade, data_diagnostico,
         naturalidade_cidade, naturalidade_estado, filiacao_mae, filiacao_pai,
         data_afastamento, atividade_anterior, num_contribuicoes)
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
         ${complement}, ${neighborhood}, ${city}, ${state}, ${notes},
         ${nis}, ${numBeneficio}, ${statusBeneficio}, ${tipoBeneficio},
         ${dataInicioBeneficio}::date, ${valorBeneficio},
         ${categoriaContribuinte}, ${carenciaAtingida},
         ${cidPrincipal}, ${tipoIncapacidade}, ${dataDiagnostico}::date,
         ${naturalidadeCidade}, ${naturalidadeEstado},
         ${filiacaoMae}, ${filiacaoPai},
         ${dataAfastamento}::date, ${atividadeAnterior}, ${numContribuicoes})
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

  // Campos previdenciários
  const nis =
    ((formData.get("nis") as string | null) ?? "").replace(/\D/g, "") || null;
  const numBeneficio =
    ((formData.get("num_beneficio") as string | null) ?? "").trim() || null;
  const statusBeneficio =
    ((formData.get("status_beneficio") as string | null) ?? "").trim() || null;
  const tipoBeneficio =
    ((formData.get("tipo_beneficio") as string | null) ?? "").trim() || null;
  const dataInicioBeneficio =
    (formData.get("data_inicio_beneficio") as string | null) || null;
  const valorBeneficioRaw =
    ((formData.get("valor_beneficio") as string | null) ?? "")
      .replace(/\./g, "")
      .replace(",", ".") || null;
  const valorBeneficio = valorBeneficioRaw ? valorBeneficioRaw : null;
  const categoriaContribuinte =
    ((formData.get("categoria_contribuinte") as string | null) ?? "").trim() ||
    null;
  const carenciaAtingida =
    formData.get("carencia_atingida") === "true"
      ? true
      : formData.get("carencia_atingida") === "false"
        ? false
        : null;
  const cidPrincipal =
    ((formData.get("cid_principal") as string | null) ?? "")
      .trim()
      .toUpperCase() || null;
  const tipoIncapacidade =
    ((formData.get("tipo_incapacidade") as string | null) ?? "").trim() || null;
  const dataDiagnostico =
    (formData.get("data_diagnostico") as string | null) || null;
  const naturalidadeCidade =
    ((formData.get("naturalidade_cidade") as string | null) ?? "").trim() ||
    null;
  const naturalidadeEstado =
    ((formData.get("naturalidade_estado") as string | null) ?? "").trim() ||
    null;
  const filiacaoMae =
    ((formData.get("filiacao_mae") as string | null) ?? "").trim() || null;
  const filiacaoPai =
    ((formData.get("filiacao_pai") as string | null) ?? "").trim() || null;
  const dataAfastamento =
    (formData.get("data_afastamento") as string | null) || null;
  const atividadeAnterior =
    ((formData.get("atividade_anterior") as string | null) ?? "").trim() ||
    null;
  const numContribuicoesRaw = (
    (formData.get("num_contribuicoes") as string | null) ?? ""
  ).trim();
  const numContribuicoes = numContribuicoesRaw
    ? parseInt(numContribuicoesRaw, 10)
    : null;

  if (!type || !name || !doc) {
    return { error: "Preencha todos os campos obrigatórios." };
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Informe um e-mail válido." };
  }

  if (email) {
    const dup =
      await sql`SELECT id FROM clients WHERE email = ${email} AND id != ${id}::uuid AND deleted_at IS NULL LIMIT 1`;
    if (dup.length > 0)
      return { error: "Este e-mail já está cadastrado em outro cliente." };
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

  const prevClient =
    await sql`SELECT status FROM clients WHERE id = ${id}::uuid LIMIT 1`.catch(
      () => []
    );
  const prevStatus =
    prevClient.length > 0 ? (prevClient[0] as { status: string }).status : null;

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
        status                  = ${status},
        nis                     = ${nis},
        num_beneficio           = ${numBeneficio},
        status_beneficio        = ${statusBeneficio},
        tipo_beneficio          = ${tipoBeneficio},
        data_inicio_beneficio   = ${dataInicioBeneficio}::date,
        valor_beneficio         = ${valorBeneficio},
        categoria_contribuinte  = ${categoriaContribuinte},
        carencia_atingida       = ${carenciaAtingida},
        cid_principal           = ${cidPrincipal},
        tipo_incapacidade       = ${tipoIncapacidade},
        data_diagnostico        = ${dataDiagnostico}::date,
        naturalidade_cidade     = ${naturalidadeCidade},
        naturalidade_estado     = ${naturalidadeEstado},
        filiacao_mae            = ${filiacaoMae},
        filiacao_pai            = ${filiacaoPai},
        data_afastamento        = ${dataAfastamento}::date,
        atividade_anterior      = ${atividadeAnterior},
        num_contribuicoes       = ${numContribuicoes}
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

  if (status === "inativo" && prevStatus === "ativo") {
    await notificarPrevBot({ evento: "cliente_inativo", clientId: id }).catch(
      () => null
    );
  }

  redirect(`/dashboard/clientes/${id}`);
}

export interface DadosPrevidenciariosComplemento {
  cid_principal?: string | null;
  tipo_incapacidade?: string | null;
  data_diagnostico?: string | null;
  data_afastamento?: string | null;
  atividade_anterior?: string | null;
  nis?: string | null;
  num_beneficio?: string | null;
  status_beneficio?: string | null;
  tipo_beneficio?: string | null;
  data_inicio_beneficio?: string | null;
  valor_beneficio?: number | null;
  filiacao_mae?: string | null;
  filiacao_pai?: string | null;
}

export async function complementarClienteAction(
  clienteId: string,
  dados: DadosPrevidenciariosComplemento
): Promise<{ error?: string; camposAtualizados: string[] }> {
  "use server";
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "editar")) {
    return { error: "Sem permissão.", camposAtualizados: [] };
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(clienteId)) {
    return { error: "ID inválido.", camposAtualizados: [] };
  }

  // Busca valores atuais para só atualizar campos que estão nulos
  let atual: Record<string, unknown>;
  try {
    const rows = await sql`
      SELECT cid_principal, tipo_incapacidade, data_diagnostico, data_afastamento,
             atividade_anterior, nis, num_beneficio, status_beneficio, tipo_beneficio,
             data_inicio_beneficio, valor_beneficio, filiacao_mae, filiacao_pai
      FROM clients WHERE id = ${clienteId}::uuid AND deleted_at IS NULL
    `;
    if (!rows[0])
      return { error: "Cliente não encontrado.", camposAtualizados: [] };
    atual = rows[0] as Record<string, unknown>;
  } catch (err) {
    console.error("complementarClienteAction SELECT error:", err);
    return { error: "Erro ao buscar dados do cliente.", camposAtualizados: [] };
  }

  // Monta lista de campos a atualizar (só onde o valor atual é nulo E o novo tem valor)
  const campos: string[] = [];
  const updates: Record<string, unknown> = {};

  const candidatos: (keyof DadosPrevidenciariosComplemento)[] = [
    "cid_principal",
    "tipo_incapacidade",
    "data_diagnostico",
    "data_afastamento",
    "atividade_anterior",
    "nis",
    "num_beneficio",
    "status_beneficio",
    "tipo_beneficio",
    "data_inicio_beneficio",
    "valor_beneficio",
    "filiacao_mae",
    "filiacao_pai",
  ];

  for (const campo of candidatos) {
    const novoValor = dados[campo];
    if (novoValor !== null && novoValor !== undefined && novoValor !== "") {
      if (
        atual[campo] === null ||
        atual[campo] === undefined ||
        atual[campo] === ""
      ) {
        updates[campo] = novoValor;
        campos.push(campo);
      }
    }
  }

  if (campos.length === 0) {
    return { camposAtualizados: [] };
  }

  const toDate = (v: unknown) => (v && typeof v === "string" ? v : null);
  const toNum = (v: unknown) =>
    v !== null && v !== undefined ? Number(v) : null;

  try {
    // COALESCE keeps existing value if not null; sets new value only if column is null
    await sql`
      UPDATE clients SET
        cid_principal         = COALESCE(cid_principal,         ${(updates["cid_principal"] as string | null) ?? null}),
        tipo_incapacidade     = COALESCE(tipo_incapacidade,     ${(updates["tipo_incapacidade"] as string | null) ?? null}),
        data_diagnostico      = COALESCE(data_diagnostico,      ${toDate(updates["data_diagnostico"])}::date),
        data_afastamento      = COALESCE(data_afastamento,      ${toDate(updates["data_afastamento"])}::date),
        atividade_anterior    = COALESCE(atividade_anterior,    ${(updates["atividade_anterior"] as string | null) ?? null}),
        nis                   = COALESCE(nis,                   ${(updates["nis"] as string | null) ?? null}),
        num_beneficio         = COALESCE(num_beneficio,         ${(updates["num_beneficio"] as string | null) ?? null}),
        status_beneficio      = COALESCE(status_beneficio,      ${(updates["status_beneficio"] as string | null) ?? null}),
        tipo_beneficio        = COALESCE(tipo_beneficio,        ${(updates["tipo_beneficio"] as string | null) ?? null}),
        data_inicio_beneficio = COALESCE(data_inicio_beneficio, ${toDate(updates["data_inicio_beneficio"])}::date),
        valor_beneficio       = COALESCE(valor_beneficio,       ${toNum(updates["valor_beneficio"])}),
        filiacao_mae          = COALESCE(filiacao_mae,          ${(updates["filiacao_mae"] as string | null) ?? null}),
        filiacao_pai          = COALESCE(filiacao_pai,          ${(updates["filiacao_pai"] as string | null) ?? null})
      WHERE id = ${clienteId}::uuid AND deleted_at IS NULL
    `;
  } catch (err) {
    console.error("complementarClienteAction UPDATE error:", err);
    return {
      error: "Erro ao atualizar dados do cliente.",
      camposAtualizados: [],
    };
  }

  try {
    await logAction({
      acao: "editar",
      entidade: "cliente",
      entidadeId: clienteId,
      descricao: `Complementou dados previdenciários via Cérebro IA: ${campos.join(", ")}`,
    });
  } catch {
    /* non-critical */
  }

  return { camposAtualizados: campos };
}

export async function deleteClientAction(
  id: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "excluir")) {
    return { error: "Sem permissão para excluir clientes." };
  }

  try {
    await sql`UPDATE clients SET deleted_at = NOW() WHERE id = ${id}::uuid AND deleted_at IS NULL`;
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
