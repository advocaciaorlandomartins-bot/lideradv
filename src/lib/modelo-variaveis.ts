/**
 * Vocabulário de variáveis {{tag}} disponíveis nos modelos de documento.
 * Fonte única usada pelo painel de inserção no editor e pelo prompt de
 * geração de modelo via IA — os dois precisam concordar exatamente nas tags.
 */
export const VARIAVEIS = [
  {
    group: "Cliente",
    vars: [
      { tag: "{{nome}}", desc: "Nome completo" },
      { tag: "{{cpf_cnpj}}", desc: "CPF ou CNPJ" },
      { tag: "{{tipo}}", desc: "PF / PJ" },
      { tag: "{{email}}", desc: "E-mail" },
      { tag: "{{telefone}}", desc: "Telefone" },
      { tag: "{{data_nascimento}}", desc: "Nascimento" },
      { tag: "{{nome_fantasia}}", desc: "Nome fantasia" },
      { tag: "{{rg}}", desc: "RG" },
      { tag: "{{rg_orgao}}", desc: "Órgão expedidor" },
      { tag: "{{estado_civil}}", desc: "Estado civil" },
      { tag: "{{genero}}", desc: "Gênero" },
      { tag: "{{profissao}}", desc: "Profissão" },
      { tag: "{{nacionalidade}}", desc: "Nacionalidade" },
      { tag: "{{parceria}}", desc: "Parceria / Origem" },
    ],
  },
  {
    group: "Responsável",
    vars: [
      { tag: "{{responsavel_nome}}", desc: "Nome" },
      { tag: "{{responsavel_cpf}}", desc: "CPF" },
      { tag: "{{responsavel_rg}}", desc: "RG" },
      { tag: "{{responsavel_rg_orgao}}", desc: "Órgão expedidor" },
      { tag: "{{responsavel_telefone}}", desc: "Telefone" },
      { tag: "{{responsavel_email}}", desc: "E-mail" },
      { tag: "{{responsavel_parentesco}}", desc: "Parentesco" },
    ],
  },
  {
    group: "Endereço",
    vars: [
      { tag: "{{endereco}}", desc: "Rua + nº + complemento" },
      { tag: "{{endereco_completo}}", desc: "Endereço com CEP" },
      { tag: "{{bairro}}", desc: "Bairro" },
      { tag: "{{cidade}}", desc: "Cidade" },
      { tag: "{{estado}}", desc: "Estado (UF)" },
      { tag: "{{cep}}", desc: "CEP" },
    ],
  },
  {
    group: "Geral",
    vars: [
      { tag: "{{data_hoje}}", desc: "Data por extenso" },
      { tag: "{{advogado}}", desc: "Nome do advogado" },
    ],
  },
] as const;

export const CATEGORIAS = [
  "Contratos",
  "Procurações",
  "Declarações",
  "Notificações",
  "Petições",
  "Previdenciário",
  "Família",
  "Trabalhista",
  "Outro",
] as const;
