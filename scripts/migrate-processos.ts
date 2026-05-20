import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS processos (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      numero              VARCHAR(50),
      tipo_acao           VARCHAR(100) NOT NULL,
      area                VARCHAR(50)  NOT NULL,
      fase                VARCHAR(50),
      vara                VARCHAR(255),
      comarca             VARCHAR(100),
      parte_contraria     VARCHAR(255),
      parte_contraria_doc VARCHAR(20),
      valor_causa         NUMERIC(15,2),
      status              VARCHAR(20)  NOT NULL DEFAULT 'ativo',
      data_distribuicao   DATE,
      notas               TEXT,
      created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓ Table processos created (or already exists)");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
