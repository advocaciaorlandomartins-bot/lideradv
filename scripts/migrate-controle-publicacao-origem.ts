import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    ALTER TABLE controles ADD COLUMN IF NOT EXISTS publicacao_id INT REFERENCES publicacoes(id)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_controles_publicacao_id ON controles (publicacao_id)
  `;
  console.log("Migração concluída: controles.publicacao_id");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
