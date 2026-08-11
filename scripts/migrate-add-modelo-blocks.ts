import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`ALTER TABLE modelos_documento ADD COLUMN IF NOT EXISTS conteudo_blocks JSONB`;
  console.log("✓ coluna conteudo_blocks adicionada em modelos_documento");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
