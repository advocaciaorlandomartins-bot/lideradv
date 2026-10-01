import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    ALTER TABLE colaboradores
    ADD COLUMN IF NOT EXISTS foto_url TEXT
  `;
  console.log("✓ colaboradores.foto_url");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
