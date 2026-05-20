import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS remuneracoes (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      colaborador_id   UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
      tipo             VARCHAR(20) NOT NULL CHECK (tipo IN ('salario', 'comissao', 'bonificacao')),
      valor            NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
      competencia      DATE,
      data_pagamento   DATE,
      status           VARCHAR(10) NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente', 'pago')),
      descricao        TEXT,
      processo_id      UUID REFERENCES processos(id) ON DELETE SET NULL,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_remuneracoes_colaborador
    ON remuneracoes (colaborador_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_remuneracoes_competencia
    ON remuneracoes (competencia)
  `;

  console.log("✓ Table remuneracoes created (or already exists)");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
