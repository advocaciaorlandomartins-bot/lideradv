import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Checklist obrigatório — array de {texto, feito} guardado como jsonb.
  // Reaproveita o padrão já usado em outras colunas jsonb do projeto
  // (controles.dados) em vez de criar uma tabela filha só pra isso.
  await sql`ALTER TABLE controles ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`ALTER TABLE tarefas_processo ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb`;

  // Timesheet — ledger de tempo gasto por colaborador em cada tarefa/
  // controle. Duração em minutos, calculada no fim (fim - inicio) quando
  // for cronômetro, ou lançada direto quando for manual (inicio = fim).
  await sql`
    CREATE TABLE IF NOT EXISTS timesheets (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      colaborador_id UUID NOT NULL REFERENCES colaboradores(id),
      origem_tipo    VARCHAR(30) NOT NULL CHECK (origem_tipo IN ('controle', 'tarefa_processo')),
      origem_id      UUID NOT NULL,
      titulo         VARCHAR(255) NOT NULL,
      descricao      TEXT,
      inicio         TIMESTAMPTZ NOT NULL,
      fim            TIMESTAMPTZ,
      duracao_min    INT,
      criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_timesheets_colaborador ON timesheets (colaborador_id, inicio)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_timesheets_origem ON timesheets (origem_tipo, origem_id)`;

  console.log(
    "✓ checklist (controles/tarefas_processo) + tabela timesheets garantidos"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
