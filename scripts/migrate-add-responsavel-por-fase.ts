import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    ALTER TABLE processos
    ADD COLUMN IF NOT EXISTS responsavel_administrativo_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL
  `;
  await sql`
    ALTER TABLE processos
    ADD COLUMN IF NOT EXISTS responsavel_judicial_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL
  `;
  console.log(
    "✓ colunas responsavel_administrativo_id e responsavel_judicial_id adicionadas em processos (registram quem fez cada fase, mesmo se o responsável atual mudar depois)"
  );
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
