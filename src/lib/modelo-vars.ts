import type { ClientFull } from "./clients-db";
import type { EscritorioConfig } from "./escritorio-db";
import type { AdvogadoParaDocumento } from "./colaboradores-db";

function formatAdvogado(a: AdvogadoParaDocumento): string {
  const base = `${a.nome}, inscrito(a) na OAB/${a.oab_uf} sob o nº ${a.oab}`;
  return a.city
    ? `${base}, com endereço profissional em ${a.city}/${a.oab_uf}`
    : base;
}

// Junta em texto corrido no padrão jurídico ("Fulano, Ciclano e Beltrano")
// em vez de vírgula solta no fim — usado quando mais de um advogado
// precisa aparecer citado no mesmo parágrafo (contrato, procuração etc.).
function joinComE(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/**
 * Mapa {{variavel}} → valor, usado tanto na geração de PDF (gerar-modelo)
 * quanto na geração de HTML pra assinatura (Assinaturas) — mesma fonte de
 * dados, pra não haver divergência entre o que o cliente vê no PDF e o que
 * ele assina.
 */
export function buildModeloVars(
  client: ClientFull,
  escritorioConfig: EscritorioConfig,
  date: string,
  advogados: AdvogadoParaDocumento[] = []
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
    // birth_date é "YYYY-MM-DD" (sem hora) — Date parseia como UTC meia-noite;
    // timeZone: "UTC" explícito evita retroceder um dia em qualquer ambiente
    // a oeste de Greenwich (mesmo padrão já usado em pdf-templates.tsx e
    // ai-juridico.ts — aqui dependia implicitamente do runtime rodar em UTC).
    "{{data_nascimento}}": client.birth_date
      ? new Date(client.birth_date).toLocaleDateString("pt-BR", {
          timeZone: "UTC",
        })
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
    "{{advogado}}":
      escritorioConfig.oab && escritorioConfig.oab_uf
        ? `${escritorioConfig.nome}, inscrito(a) na OAB/${escritorioConfig.oab_uf} sob o nº ${escritorioConfig.oab}`
        : escritorioConfig.nome,
    // Todos os advogados/advogadas ativos com OAB completa (número + UF)
    // cadastrada, prontos pra citar em procuração/contrato — antes só
    // existia {{advogado}}, que é o nome do escritório, sem OAB nenhuma.
    "{{advogados}}": joinComE(advogados.map(formatAdvogado)),
    // Endereço PROFISSIONAL do escritório (não confundir com {{endereco}}/
    // {{endereco_completo}}, que são do cliente) — usado na cláusula "Com
    // endereço profissional localizado em..." de procuração/contrato.
    // Antes esse endereço vinha digitado fixo no texto do modelo, e não
    // acompanhava quando o cadastro do escritório em Configurações mudava.
    "{{endereco_escritorio}}": [
      escritorioConfig.endereco,
      escritorioConfig.cidade && escritorioConfig.estado
        ? `${escritorioConfig.cidade}/${escritorioConfig.estado}`
        : escritorioConfig.cidade,
      escritorioConfig.cep ? `CEP ${escritorioConfig.cep}` : null,
    ]
      .filter(Boolean)
      .join(", "),
  };
}

/**
 * Substitui {{variavel}} pelo valor correspondente em texto puro (fallback
 * de modelo sem conteudo_blocks). Passada única com regex — um loop
 * sequencial de split/join por chave reprocessaria, na chave seguinte, um
 * placeholder que por coincidência apareça dentro do VALOR já substituído
 * (ex: nome de cliente contendo literalmente "{{cpf_cnpj}}"), vazando o
 * valor errado pro documento.
 */
export function replaceVars(
  texto: string,
  vars: Record<string, string>
): string {
  const keys = Object.keys(vars);
  if (keys.length === 0) return texto;
  const pattern = new RegExp(
    keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
    "g"
  );
  return texto.replace(pattern, (match) => vars[match] ?? match);
}
