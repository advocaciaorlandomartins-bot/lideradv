// Semente da Base Legal Viva (Fase 1, passo 1 do pacote especialista).
// Texto coletado diretamente de planalto.gov.br/ccivil_03/leis/l8742compilado.htm
// em 2026-10-07, lido e transcrito manualmente (não resumido por IA) a partir
// do HTML bruto da página oficial. Idempotente: pode rodar de novo com
// segurança (upsert por norma/caminho).
//
// Rodar com: npx tsx scripts/seed-base-legal.ts

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { createHash } from "crypto";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

function hash(texto: string): string {
  return createHash("sha256").update(texto, "utf8").digest("hex");
}

interface DispositivoSeed {
  caminho: string;
  texto: string;
  redacaoDadaPor: string | null;
  revogado?: boolean;
  observacao?: string | null;
}

const LOAS_ART_20: DispositivoSeed[] = [
  {
    caminho: "art. 20, caput",
    texto:
      "O benefício de prestação continuada é a garantia de um salário-mínimo mensal à pessoa com deficiência e ao idoso com 65 (sessenta e cinco) anos ou mais que comprovem não possuir meios de prover a própria manutenção nem de tê-la provida por sua família.",
    redacaoDadaPor: "Lei nº 12.435, de 2011",
    observacao: "Vide Lei nº 13.985, de 2020",
  },
  {
    caminho: "art. 20, § 1º",
    texto:
      "Para os efeitos do disposto no caput, a família é composta pelo requerente, o cônjuge ou companheiro, os pais e, na ausência de um deles, a madrasta ou o padrasto, os irmãos solteiros, os filhos e enteados solteiros e os menores tutelados, desde que vivam sob o mesmo teto.",
    redacaoDadaPor: "Lei nº 12.435, de 2011",
  },
  {
    caminho: "art. 20, § 2º",
    texto:
      "Para efeito de concessão do benefício de prestação continuada, considera-se pessoa com deficiência aquela que tem impedimento de longo prazo de natureza física, mental, intelectual ou sensorial, o qual, em interação com uma ou mais barreiras, pode obstruir sua participação plena e efetiva na sociedade em igualdade de condições com as demais pessoas.",
    redacaoDadaPor: "Lei nº 13.146, de 2015",
  },
  {
    caminho: "art. 20, § 2º-A",
    texto:
      "A concessão administrativa ou judicial do benefício de que trata este artigo a pessoa com deficiência fica sujeita a avaliação, nos termos de regulamento.",
    redacaoDadaPor: "Lei nº 15.077, de 2024",
  },
  {
    caminho: "art. 20, § 2º-B",
    texto: "(VETADO).",
    redacaoDadaPor: "Lei nº 15.077, de 2024",
    observacao: "Dispositivo vetado — sem conteúdo vigente.",
  },
  {
    caminho: "art. 20, § 3º",
    texto:
      "Observados os demais critérios de elegibilidade definidos nesta Lei, terão direito ao benefício financeiro de que trata o caput deste artigo a pessoa com deficiência ou a pessoa idosa com renda familiar mensal per capita igual ou inferior a 1/4 (um quarto) do salário-mínimo.",
    redacaoDadaPor: "Lei nº 14.176, de 2021",
  },
  {
    caminho: "art. 20, § 3º, I",
    texto: "(revogado).",
    redacaoDadaPor: "Lei nº 14.176, de 2021",
    revogado: true,
  },
  {
    caminho: "art. 20, § 3º, II",
    texto: "(VETADO).",
    redacaoDadaPor: "Lei nº 13.982, de 2020",
    observacao: "Dispositivo vetado — sem conteúdo vigente.",
  },
  {
    caminho: "art. 20, § 3º-A",
    texto:
      "O cálculo da renda familiar considerará a soma dos rendimentos auferidos mensalmente pelos membros da família que vivam sob o mesmo teto, ressalvadas as hipóteses previstas no § 14 deste artigo, nos termos estabelecidos em ato do Poder Executivo federal, vedadas deduções não previstas em lei.",
    redacaoDadaPor: "Lei nº 15.077, de 2024",
  },
  {
    caminho: "art. 20, § 4º",
    texto:
      "O benefício de que trata este artigo não pode ser acumulado pelo beneficiário com qualquer outro no âmbito da seguridade social ou de outro regime, salvo os da assistência médica e da pensão especial de natureza indenizatória, bem como as transferências de renda de que tratam o parágrafo único do art. 6º e o inciso VI do caput do art. 203 da Constituição Federal e o caput e o § 1º do art. 1º da Lei nº 10.835, de 8 de janeiro de 2004.",
    redacaoDadaPor: "Lei nº 14.601, de 2023",
  },
  {
    caminho: "art. 20, § 5º",
    texto:
      "A condição de acolhimento em instituições de longa permanência não prejudica o direito do idoso ou da pessoa com deficiência ao benefício de prestação continuada.",
    redacaoDadaPor: "Lei nº 12.435, de 2011",
  },
  {
    caminho: "art. 20, § 6º",
    texto:
      "A concessão do benefício ficará sujeita à avaliação da deficiência e do grau de impedimento de que trata o § 2º, composta por avaliação médica e avaliação social realizadas por médicos peritos e por assistentes sociais do Instituto Nacional de Seguro Social - INSS.",
    redacaoDadaPor: "Lei nº 12.470, de 2011",
  },
  {
    caminho: "art. 20, § 6º-A",
    texto:
      "O INSS poderá celebrar parcerias para a realização da avaliação social, sob a supervisão do serviço social da autarquia.",
    redacaoDadaPor: "Lei nº 14.441, de 2022",
  },
  {
    caminho: "art. 20, § 7º",
    texto:
      "Na hipótese de não existirem serviços no município de residência do beneficiário, fica assegurado, na forma prevista em regulamento, o seu encaminhamento ao município mais próximo que contar com tal estrutura.",
    redacaoDadaPor: "Lei nº 9.720, de 30.11.1998",
  },
  {
    caminho: "art. 20, § 8º",
    texto:
      "A renda familiar mensal a que se refere o § 3º deverá ser declarada pelo requerente ou seu representante legal, sujeitando-se aos demais procedimentos previstos no regulamento para o deferimento do pedido.",
    redacaoDadaPor: "Lei nº 9.720, de 30.11.1998",
  },
  {
    caminho: "art. 20, § 9º",
    texto:
      "Os valores recebidos a título de auxílio financeiro temporário ou de indenização por danos sofridos em decorrência de rompimento e colapso de barragens, bem como os rendimentos decorrentes de estágio supervisionado e de aprendizagem, não serão computados para fins de cálculo da renda familiar per capita a que se refere o § 3º deste artigo.",
    redacaoDadaPor: "Lei nº 14.809, de 2024",
  },
  {
    caminho: "art. 20, § 10",
    texto:
      "Considera-se impedimento de longo prazo, para os fins do § 2º deste artigo, aquele que produza efeitos pelo prazo mínimo de 2 (dois) anos.",
    redacaoDadaPor: "Lei nº 12.470, de 2011",
  },
  {
    caminho: "art. 20, § 11",
    texto:
      "Para concessão do benefício de que trata o caput deste artigo, poderão ser utilizados outros elementos probatórios da condição de miserabilidade do grupo familiar e da situação de vulnerabilidade, conforme regulamento.",
    redacaoDadaPor: "Lei nº 13.146, de 2015",
  },
  {
    caminho: "art. 20, § 11-A",
    texto:
      "O regulamento de que trata o § 11 deste artigo poderá ampliar o limite de renda mensal familiar per capita previsto no § 3º deste artigo para até 1/2 (meio) salário-mínimo, observado o disposto no art. 20-B desta Lei.",
    redacaoDadaPor: "Lei nº 14.176, de 2021",
  },
  {
    caminho: "art. 20, § 12",
    texto:
      "São requisitos para a concessão, a manutenção e a revisão do benefício as inscrições no Cadastro de Pessoas Físicas (CPF) e no Cadastro Único para Programas Sociais do Governo Federal - Cadastro Único, conforme previsto em regulamento.",
    redacaoDadaPor: "Lei nº 13.846, de 2019",
  },
  {
    caminho: "art. 20, § 12-A",
    texto:
      "Ao requerente do benefício de prestação continuada, ou ao responsável legal, será solicitado registro biométrico nos cadastros da Carteira de Identidade Nacional (CIN), do título eleitoral ou da Carteira Nacional de Habilitação (CNH), nos termos de ato conjunto dos órgãos competentes.",
    redacaoDadaPor: "Lei nº 14.973, de 2024",
  },
  {
    caminho: "art. 20, § 12-B",
    texto:
      "Na impossibilidade de registro biométrico do requerente, ele será obrigatório ao responsável legal.",
    redacaoDadaPor: "Lei nº 15.077, de 2024",
  },
  {
    caminho: "art. 20, § 13",
    texto: "(Sem redação própria vigente nesta compilação.)",
    redacaoDadaPor: null,
    observacao: "Vide Medida Provisória nº 871, de 2019 — conferir status.",
  },
  {
    caminho: "art. 20, § 14",
    texto:
      "O benefício de prestação continuada ou o benefício previdenciário no valor de até 1 (um) salário-mínimo concedido a idoso acima de 65 (sessenta e cinco) anos de idade ou pessoa com deficiência não será computado, para fins de concessão do benefício de prestação continuada a outro idoso ou pessoa com deficiência da mesma família, no cálculo da renda a que se refere o § 3º deste artigo.",
    redacaoDadaPor: "Lei nº 13.982, de 2020",
  },
  {
    caminho: "art. 20, § 15",
    texto:
      "O benefício de prestação continuada será devido a mais de um membro da mesma família enquanto atendidos os requisitos exigidos nesta Lei.",
    redacaoDadaPor: "Lei nº 13.982, de 2020",
  },
  {
    caminho: "art. 20, § 16",
    texto:
      "Durante a avaliação da deficiência e do grau de impedimento de que trata o § 2º deste artigo, a perícia médica dos requerentes do benefício de prestação continuada com síndrome da imunodeficiência adquirida deverá ter a participação de pelo menos 1 (um) médico especialista em infectologia.",
    redacaoDadaPor: "Lei nº 15.157, de 2025",
  },
  {
    caminho: "art. 20-A",
    texto: "(Revogado pela Lei nº 14.176, de 2021).",
    redacaoDadaPor: "Lei nº 14.176, de 2021",
    revogado: true,
  },
  {
    caminho: "art. 20-B, caput",
    texto:
      "Na avaliação de outros elementos probatórios da condição de miserabilidade e da situação de vulnerabilidade de que trata o § 11 do art. 20 desta Lei, serão considerados os seguintes aspectos para ampliação do critério de aferição da renda familiar mensal per capita de que trata o § 11-A do referido artigo:",
    redacaoDadaPor: "Lei nº 14.176, de 2021",
  },
  {
    caminho: "art. 20-B, I",
    texto: "o grau da deficiência;",
    redacaoDadaPor: "Lei nº 14.176, de 2021",
  },
  {
    caminho: "art. 20-B, II",
    texto:
      "a dependência de terceiros para o desempenho de atividades básicas da vida diária; e",
    redacaoDadaPor: "Lei nº 14.176, de 2021",
  },
  {
    caminho: "art. 20-B, III",
    texto:
      "o comprometimento do orçamento do núcleo familiar de que trata o § 3º do art. 20 desta Lei exclusivamente com gastos médicos, com tratamentos de saúde, com fraldas, com alimentos especiais e com medicamentos do idoso ou da pessoa com deficiência não disponibilizados gratuitamente pelo SUS, ou com serviços não prestados pelo Suas, desde que comprovadamente necessários à preservação da saúde e da vida.",
    redacaoDadaPor: "Lei nº 14.176, de 2021",
  },
  {
    caminho: "art. 20-B, § 1º",
    texto:
      "A ampliação de que trata o caput deste artigo ocorrerá na forma de escalas graduais, definidas em regulamento.",
    redacaoDadaPor: "Lei nº 14.176, de 2021",
  },
  {
    caminho: "art. 20-B, § 2º",
    texto:
      "Aplicam-se à pessoa com deficiência os elementos constantes dos incisos I e III do caput deste artigo, e à pessoa idosa os constantes dos incisos II e III do caput deste artigo.",
    redacaoDadaPor: "Lei nº 14.176, de 2021",
  },
  {
    caminho: "art. 20-B, § 3º",
    texto:
      "O grau da deficiência de que trata o inciso I do caput deste artigo será aferido por meio de instrumento de avaliação biopsicossocial, observados os termos dos §§ 1º e 2º do art. 2º da Lei nº 13.146, de 6 de julho de 2015 (Estatuto da Pessoa com Deficiência), e do § 6º do art. 20 e do art. 40-B desta Lei.",
    redacaoDadaPor: "Lei nº 14.176, de 2021",
  },
  {
    caminho: "art. 20-B, § 4º",
    texto:
      "O valor referente ao comprometimento do orçamento do núcleo familiar com gastos de que trata o inciso III do caput deste artigo será definido em ato conjunto do Ministério da Cidadania, da Secretaria Especial de Previdência e Trabalho do Ministério da Economia e do INSS, a partir de valores médios dos gastos realizados pelas famílias exclusivamente com essas finalidades, facultada ao interessado a possibilidade de comprovação, conforme critérios definidos em regulamento, de que os gastos efetivos ultrapassam os valores médios.",
    redacaoDadaPor: "Lei nº 14.176, de 2021",
  },

  // ─── Revisão, suspensão e cessação do BPC (art. 21, 21-A, 21-B) ──────
  {
    caminho: "art. 21, caput",
    texto:
      "O benefício de prestação continuada deve ser revisto a cada 2 (dois) anos para avaliação da continuidade das condições que lhe deram origem.",
    redacaoDadaPor: null,
    observacao: "Vide Lei nº 9.720, de 30.11.1998",
  },
  {
    caminho: "art. 21, § 1º",
    texto:
      "O pagamento do benefício cessa no momento em que forem superadas as condições referidas no caput, ou em caso de morte do beneficiário.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 21, § 2º",
    texto:
      "O benefício será cancelado quando se constatar irregularidade na sua concessão ou utilização.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 21, § 3º",
    texto:
      "O desenvolvimento das capacidades cognitivas, motoras ou educacionais e a realização de atividades não remuneradas de habilitação e reabilitação, entre outras, não constituem motivo de suspensão ou cessação do benefício da pessoa com deficiência.",
    redacaoDadaPor: "Lei nº 12.435, de 2011",
  },
  {
    caminho: "art. 21, § 4º",
    texto:
      "A cessação do benefício de prestação continuada concedido à pessoa com deficiência não impede nova concessão do benefício, desde que atendidos os requisitos definidos em regulamento.",
    redacaoDadaPor: "Lei nº 12.470, de 2011",
  },
  {
    caminho: "art. 21, § 5º",
    texto:
      "O beneficiário do benefício de prestação continuada é dispensado de avaliação médico-pericial periódica, desde que o impedimento de que trata o § 2º do art. 20 desta Lei seja permanente, irreversível ou irrecuperável, salvo quando houver fundamentada suspeita de fraude ou erro.",
    redacaoDadaPor: "Lei nº 15.157, de 2025",
  },
  {
    caminho: "art. 21-A, caput",
    texto:
      "O benefício de prestação continuada será suspenso pelo órgão concedente quando a pessoa com deficiência exercer atividade remunerada, inclusive na condição de microempreendedor individual.",
    redacaoDadaPor: "Lei nº 12.470, de 2011",
  },
  {
    caminho: "art. 21-A, § 1º",
    texto:
      "Extinta a relação trabalhista ou a atividade empreendedora de que trata o caput deste artigo e, quando for o caso, encerrado o prazo de pagamento do seguro-desemprego e não tendo o beneficiário adquirido direito a qualquer benefício previdenciário, poderá ser requerida a continuidade do pagamento do benefício suspenso, sem necessidade de realização de perícia médica ou reavaliação da deficiência e do grau de incapacidade para esse fim, respeitado o período de revisão previsto no caput do art. 21.",
    redacaoDadaPor: "Lei nº 12.470, de 2011",
  },
  {
    caminho: "art. 21-A, § 2º",
    texto:
      "A contratação de pessoa com deficiência como aprendiz não acarreta a suspensão do benefício de prestação continuada, limitado a 2 (dois) anos o recebimento concomitante da remuneração e do benefício.",
    redacaoDadaPor: "Lei nº 12.470, de 2011",
  },
  {
    caminho: "art. 21-B, caput",
    texto:
      "Os beneficiários do benefício de prestação continuada, quando não estiverem inscritos no CadÚnico ou quando estiverem com o cadastro desatualizado há mais de 24 (vinte e quatro) meses, deverão regularizar a situação nos seguintes prazos, contados a partir da efetiva notificação bancária ou por outros canais de atendimento:",
    redacaoDadaPor: "Lei nº 15.077, de 2024",
  },
  {
    caminho: "art. 21-B, I",
    texto: "45 (quarenta e cinco) dias para Municípios de pequeno porte;",
    redacaoDadaPor: "Lei nº 14.973, de 2024",
  },
  {
    caminho: "art. 21-B, II",
    texto:
      "90 (noventa) dias para Municípios de médio e grande porte ou metrópole, com população acima de 50.000 (cinquenta mil) habitantes.",
    redacaoDadaPor: "Lei nº 14.973, de 2024",
  },
  {
    caminho: "art. 21-B, § 1º",
    texto:
      "Na falta da ciência da notificação bancária ou por outros canais de atendimento, o crédito do benefício será bloqueado em 30 (trinta) dias após o envio da notificação.",
    redacaoDadaPor: "Lei nº 14.973, de 2024",
  },
  {
    caminho: "art. 21-B, § 2º",
    texto:
      "O não cumprimento do disposto no caput implicará a suspensão do benefício, desde que comprovada a ciência da notificação.",
    redacaoDadaPor: "Lei nº 14.973, de 2024",
  },
  {
    caminho: "art. 21-B, § 3º",
    texto:
      "O beneficiário poderá realizar a inclusão ou a atualização no CadÚnico até o final do prazo de suspensão, sem que haja prejuízo no pagamento do benefício.",
    redacaoDadaPor: "Lei nº 14.973, de 2024",
  },
];

async function seedFonte(
  norma: string,
  apelido: string,
  urlOficial: string,
  dispositivos: DispositivoSeed[]
) {
  // hash da fonte = hash da concatenação de todos os textos — muda se
  // qualquer dispositivo mudar, sinal pro job de resync (ainda não existe).
  const hashFonte = hash(
    dispositivos.map((d) => d.caminho + d.texto).join("\n")
  );

  const [fonte] = await sql`
    INSERT INTO fontes_legais (norma, apelido, url_oficial, hash_texto)
    VALUES (${norma}, ${apelido}, ${urlOficial}, ${hashFonte})
    ON CONFLICT (norma) DO UPDATE SET
      hash_texto = EXCLUDED.hash_texto,
      url_oficial = EXCLUDED.url_oficial,
      status = 'ativa'
    RETURNING id
  `;

  let inseridos = 0;
  for (const d of dispositivos) {
    await sql`
      INSERT INTO dispositivos
        (fonte_id, caminho, texto, redacao_dada_por, revogado, observacao, hash_texto)
      VALUES
        (${fonte.id}, ${d.caminho}, ${d.texto}, ${d.redacaoDadaPor},
         ${d.revogado ?? false}, ${d.observacao ?? null}, ${hash(d.texto)})
      ON CONFLICT (fonte_id, caminho) DO UPDATE SET
        texto = EXCLUDED.texto,
        redacao_dada_por = EXCLUDED.redacao_dada_por,
        revogado = EXCLUDED.revogado,
        observacao = EXCLUDED.observacao,
        hash_texto = EXCLUDED.hash_texto,
        verificado_em = NOW()
    `;
    inseridos++;
  }

  console.log(`${apelido}: ${inseridos} dispositivos (fonte ${fonte.id})`);
}

async function main() {
  await seedFonte(
    "Lei 8.742/1993",
    "LOAS",
    "https://www.planalto.gov.br/ccivil_03/leis/l8742compilado.htm",
    LOAS_ART_20
  );
  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
