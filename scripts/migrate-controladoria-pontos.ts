import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  // Peso em pontos de cada tarefa/controle — configurável por item, padrão 1.
  await sql`ALTER TABLE controles ADD COLUMN IF NOT EXISTS pontos INT NOT NULL DEFAULT 1`;
  await sql`ALTER TABLE tarefas_processo ADD COLUMN IF NOT EXISTS pontos INT NOT NULL DEFAULT 1`;
  // tarefas_processo nunca teve updated_at — sem isso não dá pra saber quando
  // algo mudou de status (só created_at existe).
  await sql`ALTER TABLE tarefas_processo ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`;

  // Ledger de pontuação — decidido como tabela própria (em vez de colunas
  // "concluido_por"/"concluido_em" espalhadas em controles/tarefas_processo)
  // porque as duas tabelas de origem têm modelos de responsável diferentes
  // (controles.responsavel_id é FK pra usuarios; tarefas_processo.responsavel
  // é nome livre) — um ledger único, sempre resolvido pra colaborador_id no
  // momento da baixa, evita duplicar essa lógica de resolução em cada
  // consulta de ranking. UNIQUE(origem_tipo, origem_id) garante que dar baixa
  // duas vezes no mesmo item não pontua duas vezes.
  await sql`
    CREATE TABLE IF NOT EXISTS pontuacao_eventos (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      colaborador_id UUID NOT NULL REFERENCES colaboradores(id),
      origem_tipo    VARCHAR(30) NOT NULL CHECK (origem_tipo IN ('controle', 'tarefa_processo')),
      origem_id      UUID NOT NULL,
      titulo         VARCHAR(255) NOT NULL,
      pontos         INT NOT NULL,
      criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (origem_tipo, origem_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_pontuacao_colaborador_data ON pontuacao_eventos (colaborador_id, criado_em)`;

  console.log(
    "✓ colunas pontos/updated_at + tabela pontuacao_eventos garantidas"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
