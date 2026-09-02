import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`ALTER TABLE crm_tarefas ADD COLUMN IF NOT EXISTS pontos INT NOT NULL DEFAULT 1`;
  console.log("✓ crm_tarefas.pontos");

  // pontuacao_eventos.origem_tipo tinha CHECK restrito a
  // ('controle', 'tarefa_processo') — amplia pra aceitar 'crm_tarefa'
  // agora que tarefas do CRM também pontuam.
  await sql`ALTER TABLE pontuacao_eventos DROP CONSTRAINT IF EXISTS pontuacao_eventos_origem_tipo_check`;
  await sql`
    ALTER TABLE pontuacao_eventos
    ADD CONSTRAINT pontuacao_eventos_origem_tipo_check
    CHECK (origem_tipo IN ('controle', 'tarefa_processo', 'crm_tarefa'))
  `;
  console.log("✓ pontuacao_eventos_origem_tipo_check amplo pra crm_tarefa");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
