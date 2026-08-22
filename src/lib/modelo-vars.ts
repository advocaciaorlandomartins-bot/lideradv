import type { ClientFull } from "./clients-db";
import type { EscritorioConfig } from "./escritorio-db";

/**
 * Mapa {{variavel}} → valor, usado tanto na geração de PDF (gerar-modelo)
 * quanto na geração de HTML pra assinatura (Assinaturas) — mesma fonte de
 * dados, pra não haver divergência entre o que o cliente vê no PDF e o que
 * ele assina.
 */
export function buildModeloVars(
  client: ClientFull,
  escritorioConfig: EscritorioConfig,
  date: string
): Record<string, string> {
  const addrParts = [
    client.street,
    client.addr_number,
    client.complement,
  ].filter(Boolean);
  const enderecoCompleto = `${addrParts.join(", ")}, ${client.neighborhood}, ${client.city}/${client.state}, CEP ${client.cep}`;

  return {
    "{{nome}}": client.name,
    "{{cpf_cnpj}}": client.doc,
    "{{tipo}}": client.type === "PF" ? "Pessoa Física" : "Pessoa Jurídica",
    "{{email}}": client.email,
    "{{telefone}}": client.phone,
    "{{cep}}": client.cep ?? "",
    "{{endereco}}": addrParts.join(", "),
    "{{endereco_completo}}": enderecoCompleto,
    "{{bairro}}": client.neighborhood ?? "",
    "{{cidade}}": client.city,
    "{{estado}}": client.state,
    "{{data_nascimento}}": client.birth_date
      ? new Date(client.birth_date).toLocaleDateString("pt-BR")
      : "",
    "{{nome_fantasia}}": client.trade_name ?? "",
    "{{rg}}": client.rg ?? "",
    "{{rg_orgao}}": client.rg_orgao ?? "",
    "{{estado_civil}}": client.estado_civil ?? "",
    "{{genero}}": client.genero ?? "",
    "{{profissao}}": client.profissao ?? "",
    "{{nacionalidade}}": client.nacionalidade ?? "",
    "{{parceria}}": client.parceria ?? "",
    "{{responsavel_nome}}": client.responsavel_nome ?? "",
    "{{responsavel_cpf}}": client.responsavel_cpf ?? "",
    "{{responsavel_rg}}": client.responsavel_rg ?? "",
    "{{responsavel_rg_orgao}}": client.responsavel_rg_orgao ?? "",
    "{{responsavel_telefone}}": client.responsavel_telefone ?? "",
    "{{responsavel_email}}": client.responsavel_email ?? "",
    "{{responsavel_parentesco}}": client.responsavel_parentesco ?? "",
    "{{data_hoje}}": date,
    "{{advogado}}": escritorioConfig.nome,
  };
}
