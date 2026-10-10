import type { ChecklistItem } from "./checklist-types";

/**
 * Lista padrão de documentos por tipo de benefício/ação previdenciária —
 * entra pré-marcada como pendente ao criar o cliente/processo (ver
 * criarClienteCore em client-actions.ts e createProcessoAction em
 * processo-actions.ts). É só um ponto de partida: o advogado pode
 * marcar/desmarcar e adicionar/remover itens depois (ChecklistManager),
 * então uma lista imprecisa aqui não trava nada — só erra a sugestão
 * inicial. Chave é o código do benefício (ex: "B31"), extraído do prefixo
 * de tipo_beneficio/tipo_acao (ex: "B31 - Auxílio por Incapacidade
 * Temporária").
 */
// Ordem e itens seguem o "ROL DE DOCUMENTOS PARA INICIAL" de referência do
// Orlando (2026-10-10) — mesma sequência em que ele confere os documentos
// antes de protocolar, pra não faltar nada.
const BASE: string[] = [
  "Procuração e contrato assinados",
  "RG e CPF do(a) cliente",
  "Certidão de nascimento do(a) cliente",
  "Carteira de Trabalho (CTPS), se houver",
  "Comprovante de residência atualizado (até 3 meses)",
  "CNIS atualizado",
];

const POR_CODIGO: Record<string, string[]> = {
  B21: [
    "Certidão de óbito do(a) instituidor(a)",
    "Certidão de casamento/união estável ou nascimento dos dependentes",
  ],
  B25: [
    "Certidão/atestado de recolhimento à prisão",
    "Comprovante de baixa renda do(a) instituidor(a)",
  ],
  B31: [
    "Ato impugnado (carta de indeferimento/cessação do INSS)",
    "Cópia do processo administrativo",
    "Planilha de cálculo",
    "Laudo SABI (Sistema de Administração de Benefícios por Incapacidade), se o segurado já passou por perícia médica do INSS",
    "Atestado/laudo médico detalhado",
    "Exames complementares, do mais recente ao mais antigo",
  ],
  B32: [
    "Ato impugnado (carta de indeferimento/cessação do INSS)",
    "Cópia do processo administrativo",
    "Planilha de cálculo",
    "Laudo SABI (Sistema de Administração de Benefícios por Incapacidade), se o segurado já passou por perícia médica do INSS",
    "Atestado/laudo médico detalhado",
    "Exames complementares, do mais recente ao mais antigo",
  ],
  B41: ["Carteira de Trabalho (CTPS) completa"],
  B42: [
    "Carteira de Trabalho (CTPS) completa",
    "Carnês de contribuição/GPS (se contribuinte individual)",
  ],
  B46: [
    "Carteira de Trabalho (CTPS) completa",
    "Laudo/PPP de condição especial",
  ],
  B80: [
    // "Comprovante de pelo menos uma contribuição" era o item antigo — a
    // carência foi declarada inconstitucional pelo STF (ADIs 2.110/2.111,
    // 21/03/2024); hoje o requisito é só qualidade de segurada na data do
    // fato gerador, que se prova de formas diferentes por categoria
    // (ver Enunciado 19 CRPS e Ofício-Circular DIRBEN/INSS 63/2025).
    "Comprovante de qualidade de segurada na data do parto/adoção (vínculo de emprego, contribuição como individual/facultativa, ou documento de atividade rural anterior ao fato gerador para segurada especial)",
    "Certidão de nascimento da criança (ou laudo de pré-natal, se ainda não nascida)",
  ],
  B87: [
    "Inscrição atualizada no CadÚnico (CRAS, menos de 2 anos)",
    "Formulário LOAS preenchido (gerar em Modelos)",
    "RG, CPF, certidão de nascimento e Carteira de Trabalho (se houver) de todos os moradores da residência (inclusive crianças)",
    "Comprovante de renda de todos os moradores da residência",
    "Ato impugnado (carta de indeferimento/cessação do INSS)",
    "Cópia do processo administrativo",
    "Planilha de cálculo",
    "Levantamento fotográfico de corpo inteiro e do imóvel",
    "Laudo médico atualizado com CID, assinatura e carimbo",
    "Exames médicos, do mais recente ao mais antigo (inclui os que comprovem o impedimento de longo prazo, mín. 2 anos)",
    "Atestados médicos, do mais recente ao mais antigo",
    "Comprovantes de despesas com saúde, cuidador, medicamentos ou aluguel (reduzem a renda efetiva pra fins de miserabilidade — art. 20, §11-A, Lei 8.742/93)",
    "CIPTEA (Carteira de Identificação da Pessoa com TEA), se o diagnóstico for do espectro autista — não é exigência legal, mas reforça a prova (Lei 12.764/2012)",
  ],
  B88: [
    "Inscrição atualizada no CadÚnico (CRAS, menos de 2 anos)",
    "Formulário LOAS preenchido (gerar em Modelos)",
    "RG, CPF, certidão de nascimento e Carteira de Trabalho (se houver) de todos os moradores da residência (inclusive crianças)",
    "Comprovante de renda de todos os moradores da residência",
    "Ato impugnado (carta de indeferimento/cessação do INSS)",
    "Cópia do processo administrativo",
    "Planilha de cálculo",
    "Levantamento fotográfico de corpo inteiro e do imóvel",
    "Comprovantes de despesas com saúde, cuidador, medicamentos ou aluguel (reduzem a renda efetiva pra fins de miserabilidade — art. 20, §11-A, Lei 8.742/93)",
  ],
  B91: [
    "Comunicação de Acidente de Trabalho (CAT)",
    "Atestado/laudo médico detalhado",
  ],
  B92: [
    "Comunicação de Acidente de Trabalho (CAT)",
    "Atestado/laudo médico detalhado",
  ],
  B94: [
    "Comunicação de Acidente de Trabalho (CAT)",
    "Laudo médico com sequela",
  ],
  CP: ["Cópia da carta de concessão/indeferimento"],
};

const POR_PALAVRA_CHAVE: [RegExp, string[]][] = [
  [/revis[aã]o/i, ["Cópia do processo administrativo/carta de concessão"]],
  [/acr[eé]scimo de 25/i, ["Laudo pericial de grande invalidez"]],
];

export function codigoDoTipo(tipo: string): string | null {
  const m = tipo.match(/^([A-Z]{1,2}\d{0,2})\s*-/);
  return m ? m[1] : null;
}

/** Monta a lista padrão (todos com feito:false) a partir do tipo de benefício/ação — nunca retorna lista vazia. */
export function checklistPadrao(
  tipoBeneficioOuAcao: string | null
): ChecklistItem[] {
  const extras: string[] = [];
  if (tipoBeneficioOuAcao) {
    const codigo = codigoDoTipo(tipoBeneficioOuAcao);
    if (codigo && POR_CODIGO[codigo]) extras.push(...POR_CODIGO[codigo]);
    for (const [re, itens] of POR_PALAVRA_CHAVE) {
      if (re.test(tipoBeneficioOuAcao)) extras.push(...itens);
    }
  }
  return [...BASE, ...extras].map((texto) => ({ texto, feito: false }));
}
