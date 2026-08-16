import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS comissao_administrativo_pct NUMERIC(5,2)`;
  await sql`ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS comissao_judicial_pct NUMERIC(5,2)`;
  await sql`ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS comissao_ambos_pct NUMERIC(5,2)`;
  console.log(
    "✓ colunas comissao_administrativo_pct, comissao_judicial_pct, comissao_ambos_pct adicionadas em colaboradores"
  );
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
