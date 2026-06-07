import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS compromissos (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      titulo      TEXT        NOT NULL,
      tipo        TEXT        NOT NULL DEFAULT 'outro'
                  CHECK (tipo IN ('reuniao','videochamada','fechamento','consulta','outro')),
      data_inicio DATE        NOT NULL,
      hora_inicio TIME,
      hora_fim    TIME,
      local_link  TEXT,
      descricao   TEXT,
      cor         TEXT        NOT NULL DEFAULT '#0ea5e9',
      criado_por  TEXT        NOT NULL,
      criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_compromissos_criado_por ON compromissos(criado_por)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_compromissos_data      ON compromissos(data_inicio)`;

  console.log("✅ Tabela compromissos criada com sucesso.");
}

main().catch(console.error);
