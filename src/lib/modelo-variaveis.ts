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
    group: "Família (LOAS)",
    vars: [
      {
        tag: "{{renda_familiar_per_capita}}",
        desc: "Faixa de renda per capita (CadÚnico)",
      },
      { tag: "{{membro1_nome}}", desc: "Membro 1 — nome" },
      { tag: "{{membro1_parentesco}}", desc: "Membro 1 — parentesco" },
      { tag: "{{membro1_nascimento}}", desc: "Membro 1 — nascimento" },
      { tag: "{{membro1_cpf}}", desc: "Membro 1 — CPF" },
      { tag: "{{membro2_nome}}", desc: "Membro 2 — nome" },
      { tag: "{{membro2_parentesco}}", desc: "Membro 2 — parentesco" },
      { tag: "{{membro2_nascimento}}", desc: "Membro 2 — nascimento" },
      { tag: "{{membro2_cpf}}", desc: "Membro 2 — CPF" },
      { tag: "{{membro3_nome}}", desc: "Membro 3 — nome" },
      { tag: "{{membro3_parentesco}}", desc: "Membro 3 — parentesco" },
      { tag: "{{membro3_nascimento}}", desc: "Membro 3 — nascimento" },
      { tag: "{{membro3_cpf}}", desc: "Membro 3 — CPF" },
      { tag: "{{membro4_nome}}", desc: "Membro 4 — nome" },
      { tag: "{{membro4_parentesco}}", desc: "Membro 4 — parentesco" },
      { tag: "{{membro4_nascimento}}", desc: "Membro 4 — nascimento" },
      { tag: "{{membro4_cpf}}", desc: "Membro 4 — CPF" },
      { tag: "{{membro5_nome}}", desc: "Membro 5 — nome" },
      { tag: "{{membro5_parentesco}}", desc: "Membro 5 — parentesco" },
      { tag: "{{membro5_nascimento}}", desc: "Membro 5 — nascimento" },
      { tag: "{{membro5_cpf}}", desc: "Membro 5 — CPF" },
      { tag: "{{membro6_nome}}", desc: "Membro 6 — nome" },
      { tag: "{{membro6_parentesco}}", desc: "Membro 6 — parentesco" },
      { tag: "{{membro6_nascimento}}", desc: "Membro 6 — nascimento" },
      { tag: "{{membro6_cpf}}", desc: "Membro 6 — CPF" },
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
      {
        tag: "{{advogado}}",
        desc: "Nome do escritório, com OAB se cadastrada",
      },
      {
        tag: "{{advogados}}",
        desc: "Todos os advogados ativos, com OAB e cidade",
      },
      {
        tag: "{{endereco_escritorio}}",
        desc: "Endereço profissional do escritório (não confundir com {{endereco}}, que é do cliente)",
      },
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
