import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE controles ADD COLUMN IF NOT EXISTS fatal BOOLEAN NOT NULL DEFAULT FALSE
  `;
  console.log("Migração concluída: controles.fatal");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
