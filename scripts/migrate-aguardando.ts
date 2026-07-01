import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  // Drop the auto-named status CHECK constraint (Postgres names it lancamentos_status_check)
  await sql`ALTER TABLE lancamentos DROP CONSTRAINT IF EXISTS lancamentos_status_check`;

  // Re-add with 'aguardando_resultado' included
  await sql`
    ALTER TABLE lancamentos
    ADD CONSTRAINT lancamentos_status_check
    CHECK (status IN ('pendente', 'pago', 'cancelado', 'aguardando_resultado'))
  `;

  console.log(
    "✓ lancamentos.status constraint updated — aguardando_resultado enabled"
  );
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
