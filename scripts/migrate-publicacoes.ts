import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  console.log("Criando tabelas de publicações...");

  await sql`
    CREATE TABLE IF NOT EXISTS oabs_monitoradas (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      numero        TEXT NOT NULL,
      estado        TEXT NOT NULL,
      nome_advogado TEXT,
      ativa         BOOLEAN NOT NULL DEFAULT true,
      ultima_busca  TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (numero, estado)
    )
  `;
  console.log("✓ oabs_monitoradas criada");

  await sql`
    CREATE TABLE IF NOT EXISTS publicacoes (
      id                SERIAL PRIMARY KEY,
      processo          TEXT NOT NULL,
      tipo              TEXT NOT NULL DEFAULT 'Intimação',
      destinatario      TEXT NOT NULL DEFAULT '',
      advogados         TEXT[] NOT NULL DEFAULT '{}',
      orgao             TEXT NOT NULL DEFAULT '',
      tribunal          TEXT NOT NULL DEFAULT '',
      disponibilizacao  DATE NOT NULL DEFAULT CURRENT_DATE,
      status            TEXT NOT NULL DEFAULT 'nao_lida' CHECK (status IN ('nao_lida', 'tratada')),
      origem            TEXT NOT NULL DEFAULT 'automatica' CHECK (origem IN ('automatica', 'manual')),
      conteudo          TEXT,
      conteudo_completo TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  console.log("✓ publicacoes criada");

  await sql`
    CREATE INDEX IF NOT EXISTS publicacoes_status_idx ON publicacoes (status)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS publicacoes_disponibilizacao_idx ON publicacoes (disponibilizacao DESC)
  `;
  console.log("✓ índices criados");

  console.log("Migração concluída.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
