import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    ALTER TABLE lancamentos
    ADD COLUMN IF NOT EXISTS remuneracao_id UUID
      REFERENCES remuneracoes(id) ON DELETE CASCADE
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_lancamentos_remuneracao
    ON lancamentos (remuneracao_id)
    WHERE remuneracao_id IS NOT NULL
  `;
  console.log("✓ Column remuneracao_id added to lancamentos");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
