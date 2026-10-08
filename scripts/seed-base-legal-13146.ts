// Semente da Base Legal Viva — Lei 13.146/2015 (Estatuto da Pessoa com
// Deficiência). Texto coletado diretamente de
// planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm em
// 2026-10-08, lido e transcrito manualmente (não resumido por IA).
//
// Cobertura cirúrgica: só o art. 2º (definição de pessoa com deficiência e
// critérios da avaliação biopsicossocial) — é o artigo que o próprio art.
// 20-B, § 3º da LOAS (já seedado em seed-base-legal.ts) cita por número
// ("observados os termos dos §§ 1º e 2º do art. 2º da Lei nº 13.146"), e
// que também é citado nos prompts existentes do Gerar Petição/Cérebro.
// Resto da lei (acessibilidade, educação, saúde etc.) não seedado ainda.
//
// Idempotente: pode rodar de novo com segurança (upsert por norma/caminho).
// Rodar com: npx tsx scripts/seed-base-legal-13146.ts

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

const LEI_13146: DispositivoSeed[] = [
  {
    caminho: "art. 2, caput",
    texto:
      "Considera-se pessoa com deficiência aquela que tem impedimento de longo prazo de natureza física, mental, intelectual ou sensorial, o qual, em interação com uma ou mais barreiras, pode obstruir sua participação plena e efetiva na sociedade em igualdade de condições com as demais pessoas.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 2, § 1º, caput",
    texto:
      "A avaliação da deficiência, quando necessária, será biopsicossocial, realizada por equipe multiprofissional e interdisciplinar e considerará:",
    redacaoDadaPor: null,
    observacao: "Vide Decreto nº 11.063, de 2022",
  },
  {
    caminho: "art. 2, § 1º, I",
    texto: "os impedimentos nas funções e nas estruturas do corpo;",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 2, § 1º, II",
    texto: "os fatores socioambientais, psicológicos e pessoais;",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 2, § 1º, III",
    texto: "a limitação no desempenho de atividades; e",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 2, § 1º, IV",
    texto: "a restrição de participação.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 2, § 2º",
    texto:
      "O Poder Executivo criará instrumentos para avaliação da deficiência.",
    redacaoDadaPor: null,
  },
  {
    caminho: "art. 2, § 3º",
    texto:
      "O exame médico-pericial componente da avaliação biopsicossocial da deficiência de que trata o § 1º deste artigo poderá ser realizado com o uso de tecnologia de telemedicina ou por análise documental conforme situações e requisitos definidos em regulamento.",
    redacaoDadaPor: "Lei nº 14.724, de 2023",
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
    "Lei 13.146/2015",
    "Estatuto da Pessoa com Deficiência",
    "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13146.htm",
    LEI_13146
  );
  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
