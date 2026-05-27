import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`ALTER TABLE controles ADD COLUMN IF NOT EXISTS prazo_interno DATE`;
  console.log("✓ coluna prazo_interno adicionada à tabela controles");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
