import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS meu_financeiro_lancamentos (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id    UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tipo          VARCHAR(10)  NOT NULL CHECK (tipo IN ('receita', 'despesa')),
      categoria     VARCHAR(100) NOT NULL,
      descricao     TEXT         NOT NULL,
      valor         NUMERIC(12,2) NOT NULL CHECK (valor > 0),
      data          DATE         NOT NULL,
      status        VARCHAR(20)  NOT NULL DEFAULT 'pendente'
                    CHECK (status IN ('recebido', 'a_receber', 'pago', 'pendente')),
      recorrente    BOOLEAN      NOT NULL DEFAULT FALSE,
      periodicidade VARCHAR(20)  CHECK (periodicidade IN ('semanal','quinzenal','mensal','anual')),
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_mfl_usuario_data
      ON meu_financeiro_lancamentos(usuario_id, data DESC)
  `;

  console.log("✓ tabela meu_financeiro_lancamentos criada");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
