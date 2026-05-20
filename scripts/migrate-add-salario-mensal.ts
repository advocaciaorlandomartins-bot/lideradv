import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    ALTER TABLE colaboradores
    ADD COLUMN IF NOT EXISTS salario_mensal NUMERIC(12, 2)
  `;
  console.log("✓ Column salario_mensal added to colaboradores");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
