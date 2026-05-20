import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS lancamentos (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tipo            VARCHAR(10)   NOT NULL CHECK (tipo IN ('entrada', 'saida')),
      categoria       VARCHAR(50),
      descricao       VARCHAR(255)  NOT NULL,
      valor           NUMERIC(15,2) NOT NULL,
      client_id       UUID REFERENCES clients(id)   ON DELETE SET NULL,
      processo_id     UUID REFERENCES processos(id) ON DELETE SET NULL,
      status          VARCHAR(20)   NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente', 'pago', 'cancelado')),
      data_vencimento DATE          NOT NULL,
      data_pagamento  DATE,
      parcela_atual   SMALLINT,
      total_parcelas  SMALLINT,
      grupo_parcelas  UUID,
      observacoes     TEXT,
      created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_lancamentos_tipo_status
    ON lancamentos (tipo, status)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_lancamentos_grupo
    ON lancamentos (grupo_parcelas)
    WHERE grupo_parcelas IS NOT NULL
  `;

  console.log("✓ Table lancamentos created (or already exists)");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
