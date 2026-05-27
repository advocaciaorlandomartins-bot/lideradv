import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS menor_incapaz        BOOLEAN DEFAULT FALSE`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS responsavel_nome     TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS responsavel_cpf      TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS responsavel_rg       TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS responsavel_rg_orgao TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS responsavel_telefone TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS responsavel_email    TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS responsavel_parentesco TEXT`;
  console.log("✓ colunas de responsável legal adicionadas à tabela clients");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
