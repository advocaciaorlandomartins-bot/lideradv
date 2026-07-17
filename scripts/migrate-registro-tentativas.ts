import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS registro_tentativas (
      id        BIGSERIAL PRIMARY KEY,
      ip        VARCHAR(45) NOT NULL,
      criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS registro_tentativas_ip_criado_em
      ON registro_tentativas (ip, criado_em)
  `;
  console.log("✓ registro_tentativas criada (ou já existia)");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
