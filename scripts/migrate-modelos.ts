import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS modelos_documento (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo      VARCHAR(255) NOT NULL,
      categoria   VARCHAR(100),
      descricao   VARCHAR(500),
      conteudo    TEXT NOT NULL DEFAULT '',
      ativo       BOOLEAN NOT NULL DEFAULT TRUE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓ Tabela modelos_documento criada.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
