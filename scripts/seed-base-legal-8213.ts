// Semente da Base Legal Viva — Lei 8.213/1991 (Plano de Benefícios do RGPS).
// Texto coletado diretamente de
// planalto.gov.br/ccivil_03/leis/l8213compilado.htm em 2026-10-08, lido e
// transcrito manualmente (não resumido por IA) a partir do HTML bruto da
// página oficial. Cobertura parcial de propósito — os artigos mais citados
// nos prompts existentes (ai-juridico-skills.ts, cerebroJuridico.ts):
// período de graça, carência, aposentadoria por invalidez/incapacidade
// permanente, auxílio-doença, pensão por morte. Não cobre a lei inteira
// (teto geral: Lei 8.213 tem mais de 300 artigos) — expandir sob demanda.
// Parágrafos só de procedimento administrativo recente (ex.: telemedicina
// no auxílio-doença, incisos §11-B a §11-E de MP com vigência já encerrada)
// foram deixados de fora pra não inflar a base com texto que não costuma
// embasar tese de petição.
//
// Idempotente: pode rodar de novo com segurança (upsert por norma/caminho).
// Rodar com: npx tsx scripts/seed-base-legal-8213.ts

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

const LEI_8213: DispositivoSeed[] = [
  // ─── Período de graça (art. 15) ──────────────────────────────────────
  {
    caminho: "art. 15, caput",
    texto:
      "Mantém a qualidade de segurado, independentemente de contribuições:",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 15, I",
    texto:
      "sem limite de prazo, quem está em gozo de benefício, exceto do auxílio-acidente;",
    redacaoDadaPor: "Lei nº 13.846, de 2019",
  },
  {
    caminho: "art. 15, II",
    texto:
      "até 12 (doze) meses após a cessação das contribuições, o segurado que deixar de exercer atividade remunerada abrangida pela Previdência Social ou estiver suspenso ou licenciado sem remuneração;",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 15, III",
    texto:
      "até 12 (doze) meses após cessar a segregação, o segurado acometido de doença de segregação compulsória;",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 15, IV",
    texto:
      "até 12 (doze) meses após o livramento, o segurado retido ou recluso;",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 15, V",
    texto:
      "até 3 (três) meses após o licenciamento, o segurado incorporado às Forças Armadas para prestar serviço militar;",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 15, VI",
    texto:
      "até 6 (seis) meses após a cessação das contribuições, o segurado facultativo.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 15, § 1º",
    texto:
      "O prazo do inciso II será prorrogado para até 24 (vinte e quatro) meses se o segurado já tiver pago mais de 120 (cento e vinte) contribuições mensais sem interrupção que acarrete a perda da qualidade de segurado.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 15, § 2º",
    texto:
      "Os prazos do inciso II ou do § 1º serão acrescidos de 12 (doze) meses para o segurado desempregado, desde que comprovada essa situação pelo registro no órgão próprio do Ministério do Trabalho e da Previdência Social.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 15, § 3º",
    texto:
      "Durante os prazos deste artigo, o segurado conserva todos os seus direitos perante a Previdência Social.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 15, § 4º",
    texto:
      "A perda da qualidade de segurado ocorrerá no dia seguinte ao do término do prazo fixado no Plano de Custeio da Seguridade Social para recolhimento da contribuição referente ao mês imediatamente posterior ao do final dos prazos fixados neste artigo e seus parágrafos.",
    redacaoDadaPor: null,
  },

  // ─── Carência (art. 25, 26, 27, 27-A) ────────────────────────────────
  {
    caminho: "art. 25, caput",
    texto:
      "A concessão das prestações pecuniárias do Regime Geral de Previdência Social depende dos seguintes períodos de carência, ressalvado o disposto no art. 26:",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 25, I",
    texto:
      "auxílio-doença e aposentadoria por invalidez: 12 (doze) contribuições mensais;",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 25, II",
    texto:
      "aposentadoria por idade, aposentadoria por tempo de serviço e aposentadoria especial: 180 contribuições mensais.",
    redacaoDadaPor: "Lei nº 8.870, de 1994",
  },
  {
    caminho: "art. 25, III",
    texto:
      "salário-maternidade para as seguradas de que tratam os incisos V e VII do caput do art. 11 e o art. 13 desta Lei: 10 (dez) contribuições mensais, respeitado o disposto no parágrafo único do art. 39 desta Lei; e",
    redacaoDadaPor: "Lei nº 13.846, de 2019",
    observacao: "Vide ADI 2110 e ADI 2111",
  },
  {
    caminho: "art. 25, IV",
    texto: "auxílio-reclusão: 24 (vinte e quatro) contribuições mensais.",
    redacaoDadaPor: "Lei nº 13.846, de 2019",
  },
  {
    caminho: "art. 25, parágrafo único",
    texto:
      "Em caso de parto antecipado, o período de carência a que se refere o inciso III será reduzido em número de contribuições equivalente ao número de meses em que o parto foi antecipado.",
    redacaoDadaPor: "Lei nº 9.876, de 26.11.99",
  },
  {
    caminho: "art. 26, caput",
    texto: "Independe de carência a concessão das seguintes prestações:",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 26, I",
    texto: "pensão por morte, salário-família e auxílio-acidente;",
    redacaoDadaPor: "Lei nº 13.846, de 2019",
  },
  {
    caminho: "art. 26, II",
    texto:
      "auxílio-doença e aposentadoria por invalidez nos casos de acidente de qualquer natureza ou causa e de doença profissional ou do trabalho, bem como nos casos de segurado que, após filiar-se ao RGPS, for acometido de alguma das doenças e afecções especificadas em lista elaborada pelos Ministérios da Saúde e da Previdência Social, atualizada a cada 3 (três) anos, de acordo com os critérios de estigma, deformação, mutilação, deficiência ou outro fator que lhe confira especificidade e gravidade que mereçam tratamento particularizado;",
    redacaoDadaPor: "Lei nº 13.135, de 2015",
  },
  {
    caminho: "art. 26, III",
    texto:
      "os benefícios concedidos na forma do inciso I do art. 39, aos segurados especiais referidos no inciso VII do art. 11 desta Lei;",
    redacaoDadaPor: null,
  },
  { caminho: "art. 26, IV", texto: "serviço social;", redacaoDadaPor: null },
  {
    caminho: "art. 26, V",
    texto: "reabilitação profissional.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 26, VI",
    texto:
      "salário-maternidade para as seguradas empregada, trabalhadora avulsa e empregada doméstica.",
    redacaoDadaPor: "Lei nº 9.876, de 26.11.99",
  },
  {
    caminho: "art. 27, caput",
    texto:
      "Para cômputo do período de carência, serão consideradas as contribuições:",
    redacaoDadaPor: "Lei Complementar nº 150, de 2015",
  },
  {
    caminho: "art. 27, I",
    texto:
      "referentes ao período a partir da data de filiação ao Regime Geral de Previdência Social (RGPS), no caso dos segurados empregados, inclusive os domésticos, e dos trabalhadores avulsos;",
    redacaoDadaPor: "Lei Complementar nº 150, de 2015",
  },
  {
    caminho: "art. 27, II",
    texto:
      "realizadas a contar da data de efetivo pagamento da primeira contribuição sem atraso, não sendo consideradas para este fim as contribuições recolhidas com atraso referentes a competências anteriores, no caso dos segurados contribuinte individual, especial e facultativo, referidos, respectivamente, nos incisos V e VII do art. 11 e no art. 13.",
    redacaoDadaPor: "Lei Complementar nº 150, de 2015",
  },
  {
    caminho: "art. 27-A, caput",
    texto:
      "Na hipótese de perda da qualidade de segurado, para fins da concessão dos benefícios de auxílio-doença, de aposentadoria por invalidez, de salário-maternidade e de auxílio-reclusão, o segurado deverá contar, a partir da data da nova filiação à Previdência Social, com metade dos períodos previstos nos incisos I, III e IV do caput do art. 25 desta Lei.",
    redacaoDadaPor: "Lei nº 13.846, de 2019",
  },

  // ─── Aposentadoria por invalidez / incapacidade permanente (art. 42-47) ─
  {
    caminho: "art. 42, caput",
    texto:
      "A aposentadoria por invalidez, uma vez cumprida, quando for o caso, a carência exigida, será devida ao segurado que, estando ou não em gozo de auxílio-doença, for considerado incapaz e insusceptível de reabilitação para o exercício de atividade que lhe garanta a subsistência, e ser-lhe-á paga enquanto permanecer nesta condição.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 42, § 1º",
    texto:
      "A concessão de aposentadoria por invalidez dependerá da verificação da condição de incapacidade mediante exame médico-pericial a cargo da Previdência Social, podendo o segurado, às suas expensas, fazer-se acompanhar de médico de sua confiança.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 42, § 2º",
    texto:
      "A doença ou lesão de que o segurado já era portador ao filiar-se ao Regime Geral de Previdência Social não lhe conferirá direito à aposentadoria por invalidez, salvo quando a incapacidade sobrevier por motivo de progressão ou agravamento dessa doença ou lesão.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 43, caput",
    texto:
      "A aposentadoria por invalidez será devida a partir do dia imediato ao da cessação do auxílio-doença, ressalvado o disposto nos §§ 1º, 2º e 3º deste artigo.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 43, § 1º",
    texto:
      "Concluindo a perícia médica inicial pela existência de incapacidade total e definitiva para o trabalho, a aposentadoria por invalidez será devida: a) ao segurado empregado, a contar do décimo sexto dia do afastamento da atividade ou a partir da entrada do requerimento, se entre o afastamento e a entrada do requerimento decorrerem mais de trinta dias; b) ao segurado empregado doméstico, trabalhador avulso, contribuinte individual, especial e facultativo, a contar da data do início da incapacidade ou da data da entrada do requerimento, se entre essas datas decorrerem mais de trinta dias.",
    redacaoDadaPor: "Lei nº 9.876, de 26.11.99",
  },
  {
    caminho: "art. 43, § 2º",
    texto:
      "Durante os primeiros quinze dias de afastamento da atividade por motivo de invalidez, caberá à empresa pagar ao segurado empregado o salário.",
    redacaoDadaPor: "Lei nº 9.876, de 26.11.99",
  },
  {
    caminho: "art. 44, caput",
    texto:
      "A aposentadoria por invalidez, inclusive a decorrente de acidente do trabalho, consistirá numa renda mensal correspondente a 100% (cem por cento) do salário-de-benefício, observado o disposto na Seção III, especialmente no art. 33 desta Lei.",
    redacaoDadaPor: "Lei nº 9.032, de 1995",
  },
  {
    caminho: "art. 44, § 2º",
    texto:
      "Quando o acidentado do trabalho estiver em gozo de auxílio-doença, o valor da aposentadoria por invalidez será igual ao do auxílio-doença se este, por força de reajustamento, for superior ao previsto neste artigo.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 45, caput",
    texto:
      "O valor da aposentadoria por invalidez do segurado que necessitar da assistência permanente de outra pessoa será acrescido de 25% (vinte e cinco por cento).",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 45, parágrafo único",
    texto:
      "O acréscimo de que trata este artigo: a) será devido ainda que o valor da aposentadoria atinja o limite máximo legal; b) será recalculado quando o benefício que lhe deu origem for reajustado; c) cessará com a morte do aposentado, não sendo incorporável ao valor da pensão.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 46",
    texto:
      "O aposentado por invalidez que retornar voluntariamente à atividade terá sua aposentadoria automaticamente cancelada, a partir da data do retorno.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 47, caput e I",
    texto:
      "Verificada a recuperação da capacidade de trabalho do aposentado por invalidez, será observado o seguinte procedimento: I - quando a recuperação ocorrer dentro de 5 (cinco) anos, contados da data do início da aposentadoria por invalidez ou do auxílio-doença que a antecedeu sem interrupção, o benefício cessará: a) de imediato, para o segurado empregado que tiver direito a retornar à função que desempenhava na empresa quando se aposentou, na forma da legislação trabalhista, valendo como documento, para tal fim, o certificado de capacidade fornecido pela Previdência Social; ou b) após tantos meses quantos forem os anos de duração do auxílio-doença ou da aposentadoria por invalidez, para os demais segurados;",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 47, II",
    texto:
      "quando a recuperação for parcial, ou ocorrer após o período do inciso I, ou ainda quando o segurado for declarado apto para o exercício de trabalho diverso do qual habitualmente exercia, a aposentadoria será mantida, sem prejuízo da volta à atividade: a) no seu valor integral, durante 6 (seis) meses contados da data em que for verificada a recuperação da capacidade; b) com redução de 50% (cinquenta por cento), no período seguinte de 6 (seis) meses; c) com redução de 75% (setenta e cinco por cento), também por igual período de 6 (seis) meses, ao término do qual cessará definitivamente.",
    redacaoDadaPor: null,
  },

  // ─── Aposentadoria especial / tempo especial (art. 57-58) ────────────
  {
    caminho: "art. 57, caput",
    texto:
      "A aposentadoria especial será devida, uma vez cumprida a carência exigida nesta Lei, ao segurado que tiver trabalhado sujeito a condições especiais que prejudiquem a saúde ou a integridade física, durante 15 (quinze), 20 (vinte) ou 25 (vinte e cinco) anos, conforme dispuser a lei.",
    redacaoDadaPor: "Lei nº 9.032, de 1995",
  },
  {
    caminho: "art. 57, § 1º",
    texto:
      "A aposentadoria especial, observado o disposto no art. 33 desta Lei, consistirá numa renda mensal equivalente a 100% (cem por cento) do salário-de-benefício.",
    redacaoDadaPor: "Lei nº 9.032, de 1995",
  },
  {
    caminho: "art. 57, § 3º",
    texto:
      "A concessão da aposentadoria especial dependerá de comprovação pelo segurado, perante o Instituto Nacional do Seguro Social — INSS, do tempo de trabalho permanente, não ocasional nem intermitente, em condições especiais que prejudiquem a saúde ou a integridade física, durante o período mínimo fixado.",
    redacaoDadaPor: "Lei nº 9.032, de 1995",
  },
  {
    caminho: "art. 57, § 4º",
    texto:
      "O segurado deverá comprovar, além do tempo de trabalho, exposição aos agentes nocivos químicos, físicos, biológicos ou associação de agentes prejudiciais à saúde ou à integridade física, pelo período equivalente ao exigido para a concessão do benefício.",
    redacaoDadaPor: "Lei nº 9.032, de 1995",
  },
  {
    caminho: "art. 57, § 5º",
    texto:
      "O tempo de trabalho exercido sob condições especiais que sejam ou venham a ser consideradas prejudiciais à saúde ou à integridade física será somado, após a respectiva conversão ao tempo de trabalho exercido em atividade comum, segundo critérios estabelecidos pelo Ministério da Previdência e Assistência Social, para efeito de concessão de qualquer benefício.",
    redacaoDadaPor: "Lei nº 9.032, de 1995",
  },
  {
    caminho: "art. 58, caput",
    texto:
      "A relação dos agentes nocivos químicos, físicos e biológicos ou associação de agentes prejudiciais à saúde ou à integridade física considerados para fins de concessão da aposentadoria especial de que trata o artigo anterior será definida pelo Poder Executivo.",
    redacaoDadaPor: "Lei nº 9.528, de 1997",
  },
  {
    caminho: "art. 58, § 1º",
    texto:
      "A comprovação da efetiva exposição do segurado aos agentes nocivos será feita mediante formulário, na forma estabelecida pelo Instituto Nacional do Seguro Social - INSS, emitido pela empresa ou seu preposto, com base em laudo técnico de condições ambientais do trabalho expedido por médico do trabalho ou engenheiro de segurança do trabalho nos termos da legislação trabalhista.",
    redacaoDadaPor: "Lei nº 9.732, de 11.12.98",
  },

  // ─── Auxílio-doença (art. 59-63) ─────────────────────────────────────
  {
    caminho: "art. 59, caput",
    texto:
      "O auxílio-doença será devido ao segurado que, havendo cumprido, quando for o caso, o período de carência exigido nesta Lei, ficar incapacitado para o seu trabalho ou para a sua atividade habitual por mais de 15 (quinze) dias consecutivos.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 59, § 1º",
    texto:
      "Não será devido o auxílio-doença ao segurado que se filiar ao Regime Geral de Previdência Social já portador da doença ou da lesão invocada como causa para o benefício, exceto quando a incapacidade sobrevier por motivo de progressão ou agravamento da doença ou da lesão.",
    redacaoDadaPor: "Lei nº 13.846, de 2019",
  },
  {
    caminho: "art. 60, caput",
    texto:
      "O auxílio-doença será devido ao segurado empregado a contar do décimo sexto dia do afastamento da atividade, e, no caso dos demais segurados, a contar da data do início da incapacidade e enquanto ele permanecer incapaz.",
    redacaoDadaPor: "Lei nº 9.876, de 26.11.99",
  },
  {
    caminho: "art. 60, § 1º",
    texto:
      "Quando requerido por segurado afastado da atividade por mais de 30 (trinta) dias, o auxílio-doença será devido a contar da data da entrada do requerimento.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 60, § 3º",
    texto:
      "Durante os primeiros quinze dias consecutivos ao do afastamento da atividade por motivo de doença, incumbirá à empresa pagar ao segurado empregado o seu salário integral.",
    redacaoDadaPor: "Lei nº 9.876, de 26.11.99",
  },
  {
    caminho: "art. 60, § 8º",
    texto:
      "Sempre que possível, o ato de concessão ou de reativação de auxílio-doença, judicial ou administrativo, deverá fixar o prazo estimado para a duração do benefício.",
    redacaoDadaPor: "Lei nº 13.457, de 2017",
  },
  {
    caminho: "art. 60, § 9º",
    texto:
      "Na ausência de fixação do prazo de que trata o § 8º deste artigo, o benefício cessará após o prazo de cento e vinte dias, contado da data de concessão ou de reativação do auxílio-doença, exceto se o segurado requerer a sua prorrogação perante o INSS, na forma do regulamento, observado o disposto no art. 62 desta Lei.",
    redacaoDadaPor: "Lei nº 13.457, de 2017",
  },
  {
    caminho: "art. 60, § 10",
    texto:
      "O segurado em gozo de auxílio-doença, concedido judicial ou administrativamente, poderá ser convocado a qualquer momento para avaliação das condições que ensejaram sua concessão ou manutenção, observado o disposto no art. 101 desta Lei.",
    redacaoDadaPor: "Lei nº 13.457, de 2017",
  },
  {
    caminho: "art. 60, § 11",
    texto:
      "O segurado que não concordar com o resultado da avaliação da qual dispõe o § 10 deste artigo poderá apresentar, no prazo máximo de trinta dias, recurso da decisão da administração perante o Conselho de Recursos do Seguro Social, cuja análise médica pericial, se necessária, será feita pelo assistente técnico médico da junta de recursos do seguro social, perito diverso daquele que indeferiu o benefício.",
    redacaoDadaPor: "Lei nº 13.457, de 2017",
  },
  {
    caminho: "art. 61",
    texto:
      "O auxílio-doença, inclusive o decorrente de acidente do trabalho, consistirá numa renda mensal correspondente a 91% (noventa e um por cento) do salário-de-benefício, observado o disposto na Seção III, especialmente no art. 33 desta Lei.",
    redacaoDadaPor: "Lei nº 9.032, de 1995",
  },
  {
    caminho: "art. 62, caput",
    texto:
      "O segurado em gozo de auxílio-doença, insuscetível de recuperação para sua atividade habitual, deverá submeter-se a processo de reabilitação profissional para o exercício de outra atividade.",
    redacaoDadaPor: "Lei nº 13.457, de 2017",
  },
  {
    caminho: "art. 62, § 1º",
    texto:
      "O benefício a que se refere o caput deste artigo será mantido até que o segurado seja considerado reabilitado para o desempenho de atividade que lhe garanta a subsistência ou, quando considerado não recuperável, seja aposentado por invalidez.",
    redacaoDadaPor: "Lei nº 13.846, de 2019",
  },
  {
    caminho: "art. 63, caput",
    texto:
      "O segurado empregado, inclusive o doméstico, em gozo de auxílio-doença será considerado pela empresa e pelo empregador doméstico como licenciado.",
    redacaoDadaPor: "Lei Complementar nº 150, de 2015",
  },
  {
    caminho: "art. 63, parágrafo único",
    texto:
      "A empresa que garantir ao segurado licença remunerada ficará obrigada a pagar-lhe durante o período de auxílio-doença a eventual diferença entre o valor deste e a importância garantida pela licença.",
    redacaoDadaPor: null,
  },

  // ─── Pensão por morte (art. 74-78) ───────────────────────────────────
  {
    caminho: "art. 74, caput",
    texto:
      "A pensão por morte será devida ao conjunto dos dependentes do segurado que falecer, aposentado ou não, a contar da data: I - do óbito, quando requerida em até 180 (cento e oitenta) dias após o óbito, para os filhos menores de 16 (dezesseis) anos, ou em até 90 (noventa) dias após o óbito, para os demais dependentes; II - do requerimento, quando requerida após o prazo previsto no inciso anterior; III - da decisão judicial, no caso de morte presumida.",
    redacaoDadaPor: "Lei nº 13.846, de 2019",
    observacao: "Vide Medida Provisória nº 871, de 2019",
  },
  {
    caminho: "art. 74, § 1º",
    texto:
      "Perde o direito à pensão por morte o condenado criminalmente por sentença com trânsito em julgado, como autor, coautor ou partícipe de homicídio doloso, ou de tentativa desse crime, cometido contra a pessoa do segurado, ressalvados os absolutamente incapazes e os inimputáveis.",
    redacaoDadaPor: "Lei nº 13.846, de 2019",
  },
  {
    caminho: "art. 74, § 2º",
    texto:
      "Perde o direito à pensão por morte o cônjuge, o companheiro ou a companheira se comprovada, a qualquer tempo, simulação ou fraude no casamento ou na união estável, ou a formalização desses com o fim exclusivo de constituir benefício previdenciário, apuradas em processo judicial no qual será assegurado o direito ao contraditório e à ampla defesa.",
    redacaoDadaPor: "Lei nº 13.135, de 2015",
  },
  {
    caminho: "art. 75",
    texto:
      "O valor mensal da pensão por morte será de cem por cento do valor da aposentadoria que o segurado recebia ou daquela a que teria direito se estivesse aposentado por invalidez na data de seu falecimento, observado o disposto no art. 33 desta lei.",
    redacaoDadaPor: "Lei nº 9.528, de 1997",
  },
  {
    caminho: "art. 76, caput",
    texto:
      "A concessão da pensão por morte não será protelada pela falta de habilitação de outro possível dependente, e qualquer inscrição ou habilitação posterior que importe em exclusão ou inclusão de dependente só produzirá efeito a contar da data da inscrição ou habilitação.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 76, § 1º",
    texto:
      "O cônjuge ausente não exclui do direito à pensão por morte o companheiro ou a companheira, que somente fará jus ao benefício a partir da data de sua habilitação e mediante prova de dependência econômica.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 76, § 2º",
    texto:
      "O cônjuge divorciado ou separado judicialmente ou de fato que recebia pensão de alimentos concorrerá em igualdade de condições com os dependentes referidos no inciso I do art. 16 desta Lei.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 77, caput",
    texto:
      "A pensão por morte, havendo mais de um pensionista, será rateada entre todos em parte iguais.",
    redacaoDadaPor: "Lei nº 9.032, de 1995",
  },
  {
    caminho: "art. 77, § 1º",
    texto:
      "Reverterá em favor dos demais a parte daquele cujo direito à pensão cessar.",
    redacaoDadaPor: "Lei nº 9.032, de 1995",
  },
  {
    caminho: "art. 77, § 2º, I a IV",
    texto:
      "O direito à percepção da cota individual cessará: I - pela morte do pensionista; II - para o filho, a pessoa a ele equiparada ou o irmão, de ambos os sexos, ao completar vinte e um anos de idade, salvo se for inválido ou tiver deficiência intelectual ou mental ou deficiência grave; III - para filho ou irmão inválido, pela cessação da invalidez; IV - para filho ou irmão que tenha deficiência intelectual ou mental ou deficiência grave, pelo afastamento da deficiência, nos termos do regulamento;",
    redacaoDadaPor:
      "Lei nº 13.846, de 2019 (caput do § 2º); incisos II a IV: Lei nº 13.135/13.183, de 2015",
  },
  {
    caminho: "art. 77, § 2º, V",
    texto:
      "Para cônjuge ou companheiro: a) se inválido ou com deficiência, pela cessação da invalidez ou pelo afastamento da deficiência, respeitados os períodos mínimos decorrentes da aplicação das alíneas b e c; b) em 4 (quatro) meses, se o óbito ocorrer sem que o segurado tenha vertido 18 (dezoito) contribuições mensais ou se o casamento ou a união estável tiverem sido iniciados em menos de 2 (dois) anos antes do óbito do segurado; c) transcorridos os seguintes períodos, estabelecidos de acordo com a idade do beneficiário na data de óbito do segurado, se o óbito ocorrer depois de vertidas 18 (dezoito) contribuições mensais e pelo menos 2 (dois) anos após o início do casamento ou da união estável: 1) 3 (três) anos, com menos de 21 (vinte e um) anos de idade; 2) 6 (seis) anos, entre 21 (vinte e um) e 26 (vinte e seis) anos de idade; 3) 10 (dez) anos, entre 27 (vinte e sete) e 29 (vinte e nove) anos de idade; 4) 15 (quinze) anos, entre 30 (trinta) e 40 (quarenta) anos de idade; 5) 20 (vinte) anos, entre 41 (quarenta e um) e 43 (quarenta e três) anos de idade; 6) vitalícia, com 44 (quarenta e quatro) ou mais anos de idade.",
    redacaoDadaPor: "Lei nº 13.135, de 2015",
  },
  {
    caminho: "art. 77, § 2º, VI",
    texto: "pela perda do direito, na forma do § 1º do art. 74 desta Lei.",
    redacaoDadaPor: "Lei nº 13.846, de 2019",
  },
  {
    caminho: "art. 77, § 2º-A",
    texto:
      "Serão aplicados, conforme o caso, a regra contida na alínea a ou os prazos previstos na alínea c, ambas do inciso V do § 2º, se o óbito do segurado decorrer de acidente de qualquer natureza ou de doença profissional ou do trabalho, independentemente do recolhimento de 18 (dezoito) contribuições mensais ou da comprovação de 2 (dois) anos de casamento ou de união estável.",
    redacaoDadaPor: "Lei nº 13.135, de 2015",
  },
  {
    caminho: "art. 77, § 3º",
    texto:
      "Com a extinção da parte do último pensionista a pensão extinguir-se-á.",
    redacaoDadaPor: "Lei nº 9.032, de 1995",
  },
  {
    caminho: "art. 78, caput",
    texto:
      "Por morte presumida do segurado, declarada pela autoridade judicial competente, depois de 6 (seis) meses de ausência, será concedida pensão provisória, na forma desta Subseção.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 78, § 1º",
    texto:
      "Mediante prova do desaparecimento do segurado em consequência de acidente, desastre ou catástrofe, seus dependentes farão jus à pensão provisória independentemente da declaração e do prazo deste artigo.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 78, § 2º",
    texto:
      "Verificado o reaparecimento do segurado, o pagamento da pensão cessará imediatamente, desobrigados os dependentes da reposição dos valores recebidos, salvo má-fé.",
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
    "Lei 8.213/1991",
    "Plano de Benefícios do RGPS",
    "https://www.planalto.gov.br/ccivil_03/leis/l8213compilado.htm",
    LEI_8213
  );
  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
