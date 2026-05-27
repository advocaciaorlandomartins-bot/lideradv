import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS locais_pericia (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo     VARCHAR(200) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓ tabela locais_pericia criada");

  const locais = [
    "INSS da Jatiúca",
    "INSS da Mangabeiras",
    "INSS de Arapiraca",
    "INSS de Garanhuns",
    "INSS de São Miguel dos Campos",
    "INSS do Cabo de Santo Agostinho",
    "INSS do Poço",
    "INSS do Tabuleiro dos Martins",
    "Justiça Federal de Arapiraca",
    "Justiça Federal de Maceió",
    "Justiça Federal de Santana do Ipanema",
    "Justiça Federal de União dos Palmares",
  ];

  for (const titulo of locais) {
    await sql`INSERT INTO locais_pericia (titulo) VALUES (${titulo}) ON CONFLICT (titulo) DO NOTHING`;
  }
  console.log(`✓ ${locais.length} locais pré-cadastrados`);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
