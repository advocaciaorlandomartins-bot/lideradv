import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS controles (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tipo          VARCHAR(30) NOT NULL,
      data_evento   DATE,
      descricao     TEXT NOT NULL DEFAULT '',
      status        VARCHAR(20),
      cliente_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
      processo_id   UUID REFERENCES processos(id) ON DELETE SET NULL,
      responsavel_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
      tipo_demanda  VARCHAR(20),
      observacoes   TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS controles_tipo_idx        ON controles(tipo)`;
  await sql`CREATE INDEX IF NOT EXISTS controles_status_idx      ON controles(status)`;
  await sql`CREATE INDEX IF NOT EXISTS controles_data_evento_idx ON controles(data_evento)`;
  await sql`CREATE INDEX IF NOT EXISTS controles_cliente_idx     ON controles(cliente_id)`;
  console.log("✓ tabela controles criada");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
