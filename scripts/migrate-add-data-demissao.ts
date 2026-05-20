import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    ALTER TABLE colaboradores
    ADD COLUMN IF NOT EXISTS data_demissao DATE
  `;
  console.log("✓ Column data_demissao added to colaboradores");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
