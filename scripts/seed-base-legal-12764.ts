// Semente da Base Legal Viva — Lei 12.764/2012 (Lei Berenice Piva — Política
// Nacional de Proteção dos Direitos da Pessoa com Transtorno do Espectro
// Autista). Texto coletado diretamente de
// planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12764.htm em
// 2026-10-08, lido e transcrito manualmente (não resumido por IA) —
// atenção: a página do Planalto é ISO-8859-1, não UTF-8 (decodificar como
// latin1 antes de stripar HTML, senão vira "???" nos acentos).
//
// Cobertura cirúrgica, a pedido do Orlando (focar BPC/LOAS idoso e
// deficiência/autismo + salário-maternidade, resto das aposentadorias
// fica parado por ora): só os dispositivos que sustentam a tese de que
// TEA é, por força de lei, pessoa com deficiência pra fins de BPC — a
// lei inteira tem mais artigos (Ciptea, educação, multa a gestor escolar
// etc.) que não seedei por não serem o ponto de uso no sistema hoje.
//
// Idempotente: pode rodar de novo com segurança (upsert por norma/caminho).
// Rodar com: npx tsx scripts/seed-base-legal-12764.ts

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

const LEI_12764: DispositivoSeed[] = [
  {
    caminho: "art. 1, caput",
    texto:
      "Esta Lei institui a Política Nacional de Proteção dos Direitos da Pessoa com Transtorno do Espectro Autista e estabelece diretrizes para sua consecução.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 1, § 1º, caput",
    texto:
      "Para os efeitos desta Lei, é considerada pessoa com transtorno do espectro autista aquela portadora de síndrome clínica caracterizada na forma dos seguintes incisos I ou II:",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 1, § 1º, I",
    texto:
      "deficiência persistente e clinicamente significativa da comunicação e da interação sociais, manifestada por deficiência marcada de comunicação verbal e não verbal usada para interação social; ausência de reciprocidade social; falência em desenvolver e manter relações apropriadas ao seu nível de desenvolvimento;",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 1, § 1º, II",
    texto:
      "padrões restritivos e repetitivos de comportamentos, interesses e atividades, manifestados por comportamentos motores ou verbais estereotipados ou por comportamentos sensoriais incomuns; excessiva aderência a rotinas e padrões de comportamento ritualizados; interesses restritos e fixos.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 1, § 2º",
    texto:
      "A pessoa com transtorno do espectro autista é considerada pessoa com deficiência, para todos os efeitos legais.",
    redacaoDadaPor: null,
    observacao:
      "Dispositivo-chave pra BPC/LOAS — equipara TEA a pessoa com deficiência por força de lei, sem precisar de perícia biopsicossocial pra esse ponto específico (só pra aferir o impedimento de longo prazo/grau, não pra discutir SE é deficiência).",
  },
  {
    caminho: "art. 3, caput",
    texto: "São direitos da pessoa com transtorno do espectro autista:",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 3, IV, d",
    texto: "à previdência social e à assistência social.",
    redacaoDadaPor: null,
    observacao:
      "Inciso IV ('o acesso:') lista educação (a), moradia (b), mercado de trabalho (c) e este item (d) — acesso expresso à assistência social, base de apoio ao BPC/LOAS por deficiência.",
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
    "Lei 12.764/2012",
    "Lei Berenice Piva (Autismo)",
    "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2012/lei/l12764.htm",
    LEI_12764
  );
  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
