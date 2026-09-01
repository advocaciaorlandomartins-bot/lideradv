import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

/**
 * Índices em colunas usadas em JOIN/WHERE que não tinham índice —
 * encontrado numa revisão de performance. Sem efeito perceptível hoje (base
 * ainda pequena), mas evita full table scan à medida que o escritório
 * cresce. Todos aditivos (IF NOT EXISTS), sem risco pra dado existente.
 */
async function main() {
  await sql`CREATE INDEX IF NOT EXISTS idx_controles_responsavel_id ON controles (responsavel_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_controles_fatal ON controles (fatal) WHERE fatal = TRUE`;

  await sql`CREATE INDEX IF NOT EXISTS idx_tarefas_processo_processo_id ON tarefas_processo (processo_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tarefas_processo_responsavel ON tarefas_processo (responsavel)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tarefas_processo_status ON tarefas_processo (status)`;

  await sql`CREATE INDEX IF NOT EXISTS idx_usuarios_colaborador_id ON usuarios (colaborador_id)`;

  await sql`CREATE INDEX IF NOT EXISTS idx_processos_client_id ON processos (client_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_processos_responsavel_id ON processos (responsavel_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_processos_status_ativo ON processos (status) WHERE deleted_at IS NULL`;

  console.log("Migração concluída: índices de performance.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
