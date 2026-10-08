// Semente da Base Legal Viva — Emenda Constitucional 103/2019 (Reforma da
// Previdência). Texto coletado diretamente de
// planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm em
// 2026-10-08, lido e transcrito manualmente (não resumido por IA).
// Cobertura: as 4 regras de transição de aposentadoria do RGPS (pontos,
// idade progressiva, pedágio 50%, idade mínima por idade) e a regra nova de
// cálculo/acumulação de pensão por morte. Não cobre a emenda inteira (ela
// mexe em regime próprio, militares, etc. também) — expandir sob demanda.
//
// Idempotente: pode rodar de novo com segurança (upsert por norma/caminho).
// Rodar com: npx tsx scripts/seed-base-legal-ec103.ts

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

const EC_103: DispositivoSeed[] = [
  // ─── Regra de transição por pontos (art. 15) ─────────────────────────
  {
    caminho: "art. 15, caput",
    texto:
      "Ao segurado filiado ao Regime Geral de Previdência Social até a data de entrada em vigor desta Emenda Constitucional, fica assegurado o direito à aposentadoria quando forem preenchidos, cumulativamente, os seguintes requisitos:",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 15, I",
    texto:
      "30 (trinta) anos de contribuição, se mulher, e 35 (trinta e cinco) anos de contribuição, se homem; e",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 15, II",
    texto:
      "somatório da idade e do tempo de contribuição, incluídas as frações, equivalente a 86 (oitenta e seis) pontos, se mulher, e 96 (noventa e seis) pontos, se homem, observado o disposto nos §§ 1º e 2º.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 15, § 1º",
    texto:
      "A partir de 1º de janeiro de 2020, a pontuação a que se refere o inciso II do caput será acrescida a cada ano de 1 (um) ponto, até atingir o limite de 100 (cem) pontos, se mulher, e de 105 (cento e cinco) pontos, se homem.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 15, § 3º",
    texto:
      "Para o professor que comprovar exclusivamente 25 (vinte e cinco) anos de contribuição, se mulher, e 30 (trinta) anos de contribuição, se homem, em efetivo exercício das funções de magistério na educação infantil e no ensino fundamental e médio, o somatório da idade e do tempo de contribuição, incluídas as frações, será equivalente a 81 (oitenta e um) pontos, se mulher, e 91 (noventa e um) pontos, se homem, aos quais serão acrescidos, a partir de 1º de janeiro de 2020, 1 (um) ponto a cada ano para o homem e para a mulher, até atingir o limite de 92 (noventa e dois) pontos, se mulher, e 100 (cem) pontos, se homem.",
    redacaoDadaPor: null,
  },

  // ─── Regra de transição por idade progressiva (art. 16) ──────────────
  {
    caminho: "art. 16, caput",
    texto:
      "Ao segurado filiado ao Regime Geral de Previdência Social até a data de entrada em vigor desta Emenda Constitucional fica assegurado o direito à aposentadoria quando preencher, cumulativamente, os seguintes requisitos:",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 16, I",
    texto:
      "30 (trinta) anos de contribuição, se mulher, e 35 (trinta e cinco) anos de contribuição, se homem; e",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 16, II",
    texto:
      "idade de 56 (cinquenta e seis) anos, se mulher, e 61 (sessenta e um) anos, se homem.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 16, § 1º",
    texto:
      "A partir de 1º de janeiro de 2020, a idade a que se refere o inciso II do caput será acrescida de 6 (seis) meses a cada ano, até atingir 62 (sessenta e dois) anos de idade, se mulher, e 65 (sessenta e cinco) anos de idade, se homem.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 16, § 2º",
    texto:
      "Para o professor que comprovar exclusivamente tempo de efetivo exercício das funções de magistério na educação infantil e no ensino fundamental e médio, o tempo de contribuição e a idade de que tratam os incisos I e II do caput deste artigo serão reduzidos em 5 (cinco) anos, sendo, a partir de 1º de janeiro de 2020, acrescidos 6 (seis) meses, a cada ano, às idades previstas no inciso II do caput, até atingirem 57 (cinquenta e sete) anos, se mulher, e 60 (sessenta) anos, se homem.",
    redacaoDadaPor: null,
  },

  // ─── Regra de transição por pedágio de 50% (art. 17) ──────────────────
  {
    caminho: "art. 17, caput",
    texto:
      "Ao segurado filiado ao Regime Geral de Previdência Social até a data de entrada em vigor desta Emenda Constitucional e que na referida data contar com mais de 28 (vinte e oito) anos de contribuição, se mulher, e 33 (trinta e três) anos de contribuição, se homem, fica assegurado o direito à aposentadoria quando preencher, cumulativamente, os seguintes requisitos:",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 17, I",
    texto:
      "30 (trinta) anos de contribuição, se mulher, e 35 (trinta e cinco) anos de contribuição, se homem; e",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 17, II",
    texto:
      "cumprimento de período adicional correspondente a 50% (cinquenta por cento) do tempo que, na data de entrada em vigor desta Emenda Constitucional, faltaria para atingir 30 (trinta) anos de contribuição, se mulher, e 35 (trinta e cinco) anos de contribuição, se homem.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 17, parágrafo único",
    texto:
      "O benefício concedido nos termos deste artigo terá seu valor apurado de acordo com a média aritmética simples dos salários de contribuição e das remunerações calculada na forma da lei, multiplicada pelo fator previdenciário, calculado na forma do disposto nos §§ 7º a 9º do art. 29 da Lei nº 8.213, de 24 de julho de 1991.",
    redacaoDadaPor: null,
  },

  // ─── Regra de transição por idade mínima (art. 18) ────────────────────
  {
    caminho: "art. 18, caput",
    texto:
      "O segurado de que trata o inciso I do § 7º do art. 201 da Constituição Federal filiado ao Regime Geral de Previdência Social até a data de entrada em vigor desta Emenda Constitucional poderá aposentar-se quando preencher, cumulativamente, os seguintes requisitos:",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 18, I",
    texto:
      "60 (sessenta) anos de idade, se mulher, e 65 (sessenta e cinco) anos de idade, se homem; e",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 18, II",
    texto: "15 (quinze) anos de contribuição, para ambos os sexos.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 18, § 1º",
    texto:
      "A partir de 1º de janeiro de 2020, a idade de 60 (sessenta) anos da mulher, prevista no inciso I do caput, será acrescida em 6 (seis) meses a cada ano, até atingir 62 (sessenta e dois) anos de idade.",
    redacaoDadaPor: null,
  },

  // ─── Regra geral pra quem se filiou DEPOIS da EC (art. 19) ────────────
  {
    caminho: "art. 19, caput",
    texto:
      "Até que lei disponha sobre o tempo de contribuição a que se refere o inciso I do § 7º do art. 201 da Constituição Federal, o segurado filiado ao Regime Geral de Previdência Social após a data de entrada em vigor desta Emenda Constitucional será aposentado aos 62 (sessenta e dois) anos de idade, se mulher, 65 (sessenta e cinco) anos de idade, se homem, com 15 (quinze) anos de tempo de contribuição, se mulher, e 20 (vinte) anos de tempo de contribuição, se homem.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 19, § 1º, I",
    texto:
      "Até que lei complementar disponha sobre a redução de idade mínima ou tempo de contribuição prevista nos §§ 1º e 8º do art. 201 da Constituição Federal, será concedida aposentadoria: I - aos segurados que comprovem o exercício de atividades com efetiva exposição a agentes químicos, físicos e biológicos prejudiciais à saúde, ou associação desses agentes, vedada a caracterização por categoria profissional ou ocupação, durante, no mínimo, 15 (quinze), 20 (vinte) ou 25 (vinte e cinco) anos, nos termos do disposto nos arts. 57 e 58 da Lei nº 8.213, de 24 de julho de 1991, quando cumpridos: a) 55 (cinquenta e cinco) anos de idade, quando se tratar de atividade especial de 15 (quinze) anos de contribuição; b) 58 (cinquenta e oito) anos de idade, quando se tratar de atividade especial de 20 (vinte) anos de contribuição; ou c) 60 (sessenta) anos de idade, quando se tratar de atividade especial de 25 (vinte e cinco) anos de contribuição;",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 19, § 1º, II",
    texto:
      "ao professor que comprove 25 (vinte e cinco) anos de contribuição exclusivamente em efetivo exercício das funções de magistério na educação infantil e no ensino fundamental e médio e tenha 57 (cinquenta e sete) anos de idade, se mulher, e 60 (sessenta) anos de idade, se homem.",
    redacaoDadaPor: null,
  },

  // ─── Pensão por morte — novo cálculo (art. 23) ────────────────────────
  {
    caminho: "art. 23, caput",
    texto:
      "A pensão por morte concedida a dependente de segurado do Regime Geral de Previdência Social ou de servidor público federal será equivalente a uma cota familiar de 50% (cinquenta por cento) do valor da aposentadoria recebida pelo segurado ou servidor ou daquela a que teria direito se fosse aposentado por incapacidade permanente na data do óbito, acrescida de cotas de 10 (dez) pontos percentuais por dependente, até o máximo de 100% (cem por cento).",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 23, § 1º",
    texto:
      "As cotas por dependente cessarão com a perda dessa qualidade e não serão reversíveis aos demais dependentes, preservado o valor de 100% (cem por cento) da pensão por morte quando o número de dependentes remanescente for igual ou superior a 5 (cinco).",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 23, § 2º",
    texto:
      "Na hipótese de existir dependente inválido ou com deficiência intelectual, mental ou grave, o valor da pensão por morte de que trata o caput será equivalente a: I - 100% (cem por cento) da aposentadoria recebida pelo segurado ou servidor ou daquela a que teria direito se fosse aposentado por incapacidade permanente na data do óbito, até o limite máximo de benefícios do Regime Geral de Previdência Social; e II - uma cota familiar de 50% (cinquenta por cento) acrescida de cotas de 10 (dez) pontos percentuais por dependente, até o máximo de 100% (cem por cento), para o valor que supere o limite máximo de benefícios do Regime Geral de Previdência Social.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 23, § 5º",
    texto:
      "Para o dependente inválido ou com deficiência intelectual, mental ou grave, sua condição pode ser reconhecida previamente ao óbito do segurado, por meio de avaliação biopsicossocial realizada por equipe multiprofissional e interdisciplinar, observada revisão periódica na forma da legislação.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 23, § 6º",
    texto:
      "Equiparam-se a filho, para fins de recebimento da pensão por morte, exclusivamente o enteado e o menor tutelado, desde que comprovada a dependência econômica.",
    redacaoDadaPor: null,
  },

  // ─── Acumulação de pensões/aposentadorias (art. 24) ───────────────────
  {
    caminho: "art. 24, caput",
    texto:
      "É vedada a acumulação de mais de uma pensão por morte deixada por cônjuge ou companheiro, no âmbito do mesmo regime de previdência social, ressalvadas as pensões do mesmo instituidor decorrentes do exercício de cargos acumuláveis na forma do art. 37 da Constituição Federal.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 24, § 1º",
    texto:
      "Será admitida, nos termos do § 2º, a acumulação de: I - pensão por morte deixada por cônjuge ou companheiro de um regime de previdência social com pensão por morte concedida por outro regime de previdência social ou com pensões decorrentes das atividades militares de que tratam os arts. 42 e 142 da Constituição Federal; II - pensão por morte deixada por cônjuge ou companheiro de um regime de previdência social com aposentadoria concedida no âmbito do Regime Geral de Previdência Social ou de regime próprio de previdência social ou com proventos de inatividade decorrentes das atividades militares de que tratam os arts. 42 e 142 da Constituição Federal; ou III - pensões decorrentes das atividades militares de que tratam os arts. 42 e 142 da Constituição Federal com aposentadoria concedida no âmbito do Regime Geral de Previdência Social ou de regime próprio de previdência social.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 24, § 2º",
    texto:
      "Nas hipóteses das acumulações previstas no § 1º, é assegurada a percepção do valor integral do benefício mais vantajoso e de uma parte de cada um dos demais benefícios, apurada cumulativamente de acordo com as seguintes faixas: I - 60% (sessenta por cento) do valor que exceder 1 (um) salário-mínimo, até o limite de 2 (dois) salários-mínimos; II - 40% (quarenta por cento) do valor que exceder 2 (dois) salários-mínimos, até o limite de 3 (três) salários-mínimos; III - 20% (vinte por cento) do valor que exceder 3 (três) salários-mínimos, até o limite de 4 (quatro) salários-mínimos; e IV - 10% (dez por cento) do valor que exceder 4 (quatro) salários-mínimos.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 24, § 4º",
    texto:
      "As restrições previstas neste artigo não serão aplicadas se o direito aos benefícios houver sido adquirido antes da data de entrada em vigor desta Emenda Constitucional.",
    redacaoDadaPor: null,
  },
];

async function seedFonte(
  norma: string,
  apelido: string,
  urlOficial: string,
  dispositivos: DispositivoSeed[]
) {
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
    "EC 103/2019",
    "Reforma da Previdência",
    "https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc103.htm",
    EC_103
  );
  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
