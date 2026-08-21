import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS login_tentativas (
      id        BIGSERIAL PRIMARY KEY,
      login     VARCHAR(255) NOT NULL,
      criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS login_tentativas_login_criado_em
      ON login_tentativas (login, criado_em)
  `;
  console.log("✓ login_tentativas criada (ou já existia)");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
