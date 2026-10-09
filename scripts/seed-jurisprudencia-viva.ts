// Semente da Jurisprudência Viva — escopo reduzido a pedido do Orlando
// (2026-10-08): só os precedentes relacionados a BPC/LOAS (B87 deficiência,
// B88 idoso) e salário-maternidade (B80) que já foram CONFIRMADOS contra
// fonte oficial/busca dedicada nesta mesma sessão de auditoria (ver
// docs/auditoria-tecnica.md, seções 11-19 pra cada verificação individual).
// Não é um levantamento novo — é estruturar o que já foi verificado.
//
// Idempotente (upsert por tribunal+identificação). Rodar com:
// npx tsx scripts/seed-jurisprudencia-viva.ts

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

interface PrecedenteSeed {
  tribunal: string;
  identificacao: string;
  tese: string;
  beneficios: string[];
  status?: "vigente" | "superado";
  observacao?: string;
}

const PRECEDENTES: PrecedenteSeed[] = [
  {
    tribunal: "STF",
    identificacao: "Tema 27 (RE 567.985 e RE 580.963)",
    tese: "O critério de renda familiar per capita inferior a 1/4 do salário-mínimo (art. 20, §3º, Lei 8.742/93) não é o único meio de prova da condição de miserabilidade — é um critério objetivo relativizável, o juiz pode aferir a hipossuficiência por outros meios de prova.",
    beneficios: ["B87", "B88"],
    observacao:
      "Julgado em 18/04/2013 junto com a RCL 4.374/PE, mesma Plenário, mesmo entendimento.",
  },
  {
    tribunal: "STF",
    identificacao: "RCL 4.374/PE",
    tese: "Declarada a inconstitucionalidade parcial do art. 20, §3º, da Lei 8.742/93 (LOAS) como critério ÚNICO de miserabilidade para o BPC — o juiz pode considerar outros elementos de prova da hipossuficiência.",
    beneficios: ["B87", "B88"],
    observacao: "Plenário, 18/04/2013.",
  },
  {
    tribunal: "STF",
    identificacao: "Tema 312",
    tese: "Benefícios de renda mínima garantidos por outras políticas de assistência social (ex.: Bolsa Família) e transferências de renda constitucionais não entram no cálculo da renda familiar per capita para fins de BPC.",
    beneficios: ["B87", "B88"],
  },
  {
    tribunal: "STF",
    identificacao: "Tema 100 (RE 586.068)",
    tese: "A coisa julgada formada em juizado especial pode ser revisada quando fundada em lei posteriormente declarada inconstitucional — usado para fundamentar novo requerimento de salário-maternidade mesmo após indeferimento anterior transitado em julgado, à luz das ADIs 2.110/2.111.",
    beneficios: ["B80"],
  },
  {
    tribunal: "STF",
    identificacao: "ADI 2.110",
    tese: "Declarada inconstitucional a exigência de carência (art. 25, III, Lei 8.213/91) para concessão de salário-maternidade a contribuinte individual. Único requisito remanescente: qualidade de segurada na data do parto/adoção/guarda.",
    beneficios: ["B80"],
    observacao:
      "Julgada em 21/03/2024, em conjunto com a ADI 2.111. Deferimento administrativo automático no INSS desde 05/04/2024.",
  },
  {
    tribunal: "STF",
    identificacao: "ADI 2.111",
    tese: "Mesma tese da ADI 2.110 — inconstitucionalidade da exigência de carência para salário-maternidade, julgada em conjunto.",
    beneficios: ["B80"],
    observacao: "Julgada em 21/03/2024.",
  },
  {
    tribunal: "TNU",
    identificacao: "Tema 187",
    tese: "Para requerimentos de BPC a partir de 07/11/2016, se o indeferimento administrativo do INSS se deu exclusivamente por não reconhecimento da deficiência médica (sem impugnação específica do critério de renda), é desnecessária a produção em juízo de nova prova de miserabilidade — o critério socioeconômico já reconhecido administrativamente torna-se fato incontroverso.",
    beneficios: ["B87", "B88"],
    observacao:
      "Ressalva: não vale se houver impugnação fundamentada da autarquia ou se o indeferimento tiver mais de 2 anos.",
  },
  {
    tribunal: "TNU",
    identificacao: "Tema 173",
    tese: "O impedimento de longo prazo (mínimo de 2 anos, art. 20, §§2º e 10, LOAS) pode ser reconhecido de forma PROSPECTIVA — mesmo que o laudo pericial classifique a incapacidade como 'temporária', se o quadro clínico e o histórico demonstram que os efeitos devem durar mais de 2 anos, conta para fins de BPC.",
    beneficios: ["B87"],
  },
  {
    tribunal: "TNU",
    identificacao: "Tema 11",
    tese: "Para segurada especial (rural), a exigência de início de prova material contemporâneo ao início do período de carência pode ser flexibilizada na concessão de salário-maternidade.",
    beneficios: ["B80"],
  },
  {
    tribunal: "CRPS",
    identificacao: "Enunciado 19 (Resolução CRPS nº 13/2025)",
    tese: "Não se exige carência para concessão de salário-maternidade em nenhuma categoria de segurada, à luz da ADI 2.110. Contribuinte individual deve provar exercício de atividade remunerada + ao menos 1 contribuição; se não comprovar atividade, deve ser enquadrada como segurada facultativa (sem exigência de prova de atividade). Segurada especial (rural): basta 1 documento rural anterior ao fato gerador.",
    beneficios: ["B80"],
    observacao: "Resolução de 27/08/2025, publicada no DOU em 08/09/2025.",
  },
];

async function main() {
  let inseridos = 0;
  for (const p of PRECEDENTES) {
    await sql`
      INSERT INTO precedentes (tribunal, identificacao, tese, beneficios, status, observacao)
      VALUES (
        ${p.tribunal}, ${p.identificacao}, ${p.tese}, ${p.beneficios},
        ${p.status ?? "vigente"}, ${p.observacao ?? null}
      )
      ON CONFLICT (tribunal, identificacao) DO UPDATE SET
        tese = EXCLUDED.tese,
        beneficios = EXCLUDED.beneficios,
        status = EXCLUDED.status,
        observacao = EXCLUDED.observacao,
        verificado_em = NOW()
    `;
    inseridos++;
  }
  console.log(`${inseridos} precedentes seedados.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
