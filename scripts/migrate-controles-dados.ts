import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`ALTER TABLE controles ADD COLUMN IF NOT EXISTS dados JSONB`;
  console.log("✓ coluna dados adicionada à tabela controles");

  await sql`
    CREATE TABLE IF NOT EXISTS locais_audiencia (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo     VARCHAR(200) NOT NULL UNIQUE,
      endereco   TEXT,
      mapa_url   TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓ tabela locais_audiencia criada");

  const locais = [
    "10ª Vara do Trabalho",
    "1º Juizado Especial Cível de Maceió",
    "24ª Vara de Família de Maceió/AL",
    "26ª Vara de Família de Maceió/AL",
    "5ª Vara do Trabalho",
    "5º Juizado Especial Cível de Maceió",
    "6º Juizado Especial Cível de Maceió",
    "7ª Vara do Trabalho",
    "9ª Vara do Trabalho",
    "9º Juizado Especial Cível da Capital",
    "Justiça Federal de Arapiraca",
    "Justiça Federal de Maceió",
  ];

  for (const titulo of locais) {
    await sql`INSERT INTO locais_audiencia (titulo) VALUES (${titulo}) ON CONFLICT (titulo) DO NOTHING`;
  }
  console.log(`✓ ${locais.length} locais pré-cadastrados`);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
