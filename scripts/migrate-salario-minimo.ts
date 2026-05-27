import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    ALTER TABLE escritorio_config
    ADD COLUMN IF NOT EXISTS salario_minimo NUMERIC(10,2) DEFAULT 1518.00
  `;
  console.log("✓ coluna salario_minimo adicionada à tabela escritorio_config");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
