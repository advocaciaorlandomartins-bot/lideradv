import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS pericias (
      id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tipo                VARCHAR(50)  NOT NULL CHECK (tipo IN (
                            'pericia_administrativa',
                            'pericia_judicial',
                            'avaliacao_social_administrativa',
                            'avaliacao_social_judicial',
                            'prorrogacao_beneficio'
                          )),
      client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      processo_id         UUID REFERENCES processos(id) ON DELETE SET NULL,
      data_pericia        DATE         NOT NULL,
      hora_pericia        TIME,
      local_pericia       VARCHAR(255),
      perito              VARCHAR(255),
      especialidade       VARCHAR(100),
      status              VARCHAR(20)  NOT NULL DEFAULT 'agendado'
                          CHECK (status IN ('agendado', 'realizado', 'cancelado', 'remarcado')),
      resultado           VARCHAR(20)
                          CHECK (resultado IN ('favoravel', 'desfavoravel', 'pendente', 'inconclusivo')),
      beneficio_numero    VARCHAR(30),
      beneficio_tipo      VARCHAR(100),
      data_fim_beneficio  DATE,
      nova_data_fim       DATE,
      observacoes         TEXT,
      created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_pericias_client
    ON pericias (client_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_pericias_data
    ON pericias (data_pericia)
  `;

  console.log("✓ Table pericias created (or already exists)");

  // Expand the documentos entity_type CHECK to include 'pericia'
  await sql`
    ALTER TABLE documentos
      DROP CONSTRAINT IF EXISTS documentos_entity_type_check
  `;
  await sql`
    ALTER TABLE documentos
      ADD CONSTRAINT documentos_entity_type_check
      CHECK (entity_type IN ('processo', 'cliente', 'pericia'))
  `;
  console.log("✓ documentos entity_type constraint updated");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
