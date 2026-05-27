import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`ALTER TABLE escritorio_config ADD COLUMN IF NOT EXISTS modelo_timbrado VARCHAR(20) NOT NULL DEFAULT 'classico'`;
  console.log("✓ coluna modelo_timbrado adicionada em escritorio_config");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
