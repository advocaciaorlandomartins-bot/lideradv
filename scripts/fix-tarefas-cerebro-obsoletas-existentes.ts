import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

/**
 * Backfill único: conclui tarefas geradas pelo Cérebro Jurídico que ficaram
 * "Pendente" presas num estágio anterior do processo (ex: "Verificar
 * documentação com cliente" criada na análise inicial, com o processo já em
 * "judicial") — mesma regra que producao-actions.ts passou a aplicar daqui
 * pra frente a cada avanço de estágio. Sem isso, essas tarefas antigas iam
 * continuar aparecendo em Minhas Tarefas ao lado da ação real do estágio
 * atual pra sempre, já que o backfill só corrige o que já existia até agora.
 */
async function main() {
  const antes = await sql`
    SELECT t.id::text, t.titulo, p.id::text AS processo_id, c.name AS cliente_nome,
           p.estagio_producao
    FROM tarefas_processo t
    JOIN processos p ON p.id = t.processo_id
    LEFT JOIN clients c ON c.id = p.client_id
    WHERE t.status IN ('Pendente', 'Em andamento')
      AND t.comentarios ILIKE '%Cérebro Jurídico%'
      AND p.estagio_producao IN ('producao', 'administrativo', 'judicial', 'arquivado')
  `;
  console.log(`Tarefas obsoletas encontradas: ${antes.length}`);
  for (const r of antes) {
    console.log(
      `  - "${r.titulo}" — ${r.cliente_nome ?? "sem cliente"} (estágio: ${r.estagio_producao})`
    );
  }

  if (antes.length === 0) {
    console.log("Nada para corrigir.");
    return;
  }

  const rows = await sql`
    UPDATE tarefas_processo t
    SET status = 'Concluída',
        comentarios = COALESCE(t.comentarios || ' ', '') || '[auto-concluída: estágio do processo avançou]',
        updated_at = NOW()
    FROM processos p
    WHERE t.processo_id = p.id
      AND t.status IN ('Pendente', 'Em andamento')
      AND t.comentarios ILIKE '%Cérebro Jurídico%'
      AND p.estagio_producao IN ('producao', 'administrativo', 'judicial', 'arquivado')
    RETURNING t.id::text
  `;
  console.log(`✓ ${rows.length} tarefa(s) auto-concluída(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
