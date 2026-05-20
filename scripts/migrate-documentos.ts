import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS documentos (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      entity_type VARCHAR(20) NOT NULL CHECK (entity_type IN ('processo', 'cliente')),
      entity_id   UUID NOT NULL,
      nome        VARCHAR(255) NOT NULL,
      tipo        VARCHAR(100),
      tamanho     BIGINT,
      caminho     TEXT NOT NULL,
      url         TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_documentos_entity
    ON documentos (entity_type, entity_id)
  `;

  console.log("✓ Table documentos created (or already exists)");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
