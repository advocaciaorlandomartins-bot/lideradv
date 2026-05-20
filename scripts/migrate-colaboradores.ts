import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS colaboradores (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome            VARCHAR(255) NOT NULL,
      cargo           VARCHAR(30)  NOT NULL CHECK (cargo IN (
                        'advogado',
                        'estagiario',
                        'recepcao',
                        'agente',
                        'advogado_associado',
                        'comercial'
                      )),
      email           VARCHAR(255),
      telefone        VARCHAR(20),
      oab             VARCHAR(30),
      data_admissao   DATE,
      status          VARCHAR(10)  NOT NULL DEFAULT 'ativo'
                      CHECK (status IN ('ativo', 'inativo')),
      observacoes     TEXT,
      created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_colaboradores_cargo
    ON colaboradores (cargo)
  `;

  console.log("✓ Table colaboradores created (or already exists)");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
