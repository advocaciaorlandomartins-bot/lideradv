import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

// tarefas_processo.status foi criado com DEFAULT 'pendente' (minúsculo), mas
// todo o resto do app (Minhas Tarefas, Carga da equipe, Cérebro Jurídico)
// compara com 'Pendente'/'Em andamento'/'Concluída'/'Cancelada' (maiúsculo).
// Toda tarefa criada sem status explícito (Cérebro Jurídico e o formulário
// "Nova Tarefa") caía no default minúsculo e ficava invisível em todo lugar
// que filtra por status — nunca aparecia em Minhas Tarefas nem na Carga da
// equipe, mesmo estando pendente de verdade.
async function main() {
  await sql`ALTER TABLE tarefas_processo ALTER COLUMN status SET DEFAULT 'Pendente'`;
  console.log("Default de tarefas_processo.status corrigido para 'Pendente'.");

  const backfill = await sql`
    UPDATE tarefas_processo SET status = 'Pendente'
    WHERE status = 'pendente'
    RETURNING id
  `;
  console.log(
    `Backfill: ${backfill.length} tarefa(s) corrigida(s) de 'pendente' para 'Pendente'.`
  );

  // tarefas_processo.responsavel é texto livre (sem FK) — tarefas criadas
  // automaticamente pelo Cérebro Jurídico antes da resolução do nome do
  // responsável ficaram com essa coluna NULL, o que também as escondia da
  // Carga da equipe (que junta por nome). Preenche a partir do responsável
  // atual do processo vinculado.
  const backfillResp = await sql`
    UPDATE tarefas_processo t
    SET responsavel = col.nome
    FROM processos p
    JOIN colaboradores col ON col.id = p.responsavel_id
    WHERE t.processo_id = p.id
      AND t.responsavel IS NULL
    RETURNING t.id
  `;
  console.log(
    `Backfill: ${backfillResp.length} tarefa(s) receberam responsável a partir do processo.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
