import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`ALTER TABLE escritorio_config ADD COLUMN IF NOT EXISTS font_padrao   VARCHAR(20)     NOT NULL DEFAULT 'Times'`;
  await sql`ALTER TABLE escritorio_config ADD COLUMN IF NOT EXISTS tamanho_padrao NUMERIC(4,1)   NOT NULL DEFAULT 12`;
  await sql`ALTER TABLE escritorio_config ADD COLUMN IF NOT EXISTS line_height    NUMERIC(4,2)   NOT NULL DEFAULT 1.8`;
  await sql`ALTER TABLE escritorio_config ADD COLUMN IF NOT EXISTS margem_topo    NUMERIC(6,1)   NOT NULL DEFAULT 25`;
  await sql`ALTER TABLE escritorio_config ADD COLUMN IF NOT EXISTS margem_direita NUMERIC(6,1)   NOT NULL DEFAULT 25`;
  await sql`ALTER TABLE escritorio_config ADD COLUMN IF NOT EXISTS margem_inferior NUMERIC(6,1)  NOT NULL DEFAULT 28`;
  await sql`ALTER TABLE escritorio_config ADD COLUMN IF NOT EXISTS margem_esquerda NUMERIC(6,1)  NOT NULL DEFAULT 25`;
  console.log(
    "✓ colunas de tipografia e margens adicionadas em escritorio_config"
  );
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
