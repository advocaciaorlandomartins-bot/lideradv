import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    ALTER TABLE remuneracoes
    ADD COLUMN IF NOT EXISTS origem_lancamento_id UUID REFERENCES lancamentos(id) ON DELETE SET NULL
  `;
  // client_id já é usado por createRemuneracaoAction, mas nenhuma migração
  // deste repo o criava — garante que a coluna exista antes da comissão
  // automática também depender dela.
  await sql`
    ALTER TABLE remuneracoes
    ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_remuneracoes_origem_lancamento
    ON remuneracoes (origem_lancamento_id)
  `;
  console.log(
    "✓ colunas origem_lancamento_id e client_id garantidas em remuneracoes"
  );
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
