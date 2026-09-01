import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS tarefa_responsaveis_adicionais (
      tarefa_id UUID NOT NULL REFERENCES tarefas_processo(id) ON DELETE CASCADE,
      colaborador_id UUID NOT NULL REFERENCES colaboradores(id),
      criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (tarefa_id, colaborador_id)
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_tarefa_resp_adic_colaborador
    ON tarefa_responsaveis_adicionais (colaborador_id)
  `;
  console.log("Migração concluída: tarefa_responsaveis_adicionais");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
