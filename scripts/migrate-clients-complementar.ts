import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS rg             TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS rg_orgao       TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS estado_civil   TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS genero         TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS profissao      TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS nacionalidade  TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS senha_cliente  TEXT`;
  await sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS parceria       TEXT`;
  console.log("✓ colunas complementares adicionadas à tabela clients");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
