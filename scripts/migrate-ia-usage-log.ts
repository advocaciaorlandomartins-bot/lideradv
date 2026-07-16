import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS ia_usage_log (
      id         BIGSERIAL PRIMARY KEY,
      user_login VARCHAR(100) NOT NULL,
      criado_em  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS ia_usage_log_user_criado_em
      ON ia_usage_log (user_login, criado_em)
  `;
  console.log("✓ ia_usage_log criada (ou já existia)");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
