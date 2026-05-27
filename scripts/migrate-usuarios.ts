import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS usuarios (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      login        VARCHAR(100) NOT NULL UNIQUE,
      nome         VARCHAR(255) NOT NULL,
      senha_hash   TEXT NOT NULL DEFAULT '',
      categoria    VARCHAR(50)  NOT NULL DEFAULT 'Colaborador(a)',
      validade     DATE,
      ultimo_acesso TIMESTAMPTZ,
      ativo        BOOLEAN NOT NULL DEFAULT TRUE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓ tabela usuarios criada");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
