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
const BASE: string[] = [
  "RG e CPF do(a) cliente",
  "Comprovante de residência atualizado",
  "Procuração e contrato assinados",
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
  B31: ["Atestado/laudo médico detalhado", "Exames complementares"],
  B32: ["Atestado/laudo médico detalhado", "Exames complementares"],
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
    "Certidão de nascimento do(a) filho(a) ou laudo de pré-natal",
    "Comprovante de afastamento do trabalho",
  ],
  B87: [
    "Declaração de composição familiar",
    "Comprovante de renda de todos os membros da família",
    "Laudo médico (avaliação de deficiência)",
  ],
  B88: [
    "Declaração de composição familiar",
    "Comprovante de renda de todos os membros da família",
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

function codigoDoTipo(tipo: string): string | null {
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
