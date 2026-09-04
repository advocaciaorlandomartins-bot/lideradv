import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS iris_conversas (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      titulo      VARCHAR(255) NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_iris_conversas_usuario
    ON iris_conversas (usuario_id, updated_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS iris_mensagens (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversa_id UUID NOT NULL REFERENCES iris_conversas(id) ON DELETE CASCADE,
      role        VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant')),
      content     TEXT NOT NULL,
      anexos      JSONB,
      tool_trace  JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_iris_mensagens_conversa
    ON iris_mensagens (conversa_id, created_at)
  `;

  console.log(
    "✓ Tabelas iris_conversas e iris_mensagens criadas (ou já existiam)"
  );
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
