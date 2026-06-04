import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS google_tokens (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      access_token    TEXT NOT NULL,
      refresh_token   TEXT,
      token_expiry    TIMESTAMPTZ,
      google_email    TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (usuario_id)
    )
  `;
  console.log("✓ Tabela google_tokens criada/verificada.");
}

main().catch(console.error);
