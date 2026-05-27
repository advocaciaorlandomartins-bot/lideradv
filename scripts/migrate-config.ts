import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  // Escritório config — sempre exatamente 1 linha
  await sql`
    CREATE TABLE IF NOT EXISTS escritorio_config (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome       VARCHAR(255) NOT NULL DEFAULT 'Advocacia Orlando Martins',
      oab        VARCHAR(100),
      telefone   VARCHAR(30),
      email      VARCHAR(255),
      site       VARCHAR(255),
      endereco   VARCHAR(500),
      cidade     VARCHAR(100),
      estado     VARCHAR(2),
      cep        VARCHAR(10),
      logo_url   TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Garante linha inicial
  await sql`
    INSERT INTO escritorio_config (nome)
    SELECT 'Advocacia Orlando Martins'
    WHERE NOT EXISTS (SELECT 1 FROM escritorio_config)
  `;

  // Adiciona usar_timbrado em modelos_documento
  await sql`
    ALTER TABLE modelos_documento
    ADD COLUMN IF NOT EXISTS usar_timbrado BOOLEAN NOT NULL DEFAULT TRUE
  `;

  console.log("✓ escritorio_config criada + usar_timbrado adicionado");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
