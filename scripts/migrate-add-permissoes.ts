import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    ALTER TABLE usuarios
      ADD COLUMN IF NOT EXISTS colaborador_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS permissoes    JSONB
  `;
  console.log("✓ colunas colaborador_id e permissoes adicionadas a usuarios");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
