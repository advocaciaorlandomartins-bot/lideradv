import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });
const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  // ── Novos campos em processos ────────────────────────────────
  await sql`ALTER TABLE processos ADD COLUMN IF NOT EXISTS tipo_demanda  VARCHAR(20)  DEFAULT 'Judicial'`;
  await sql`ALTER TABLE processos ADD COLUMN IF NOT EXISTS prioridade    VARCHAR(10)  DEFAULT 'Média'`;
  await sql`ALTER TABLE processos ADD COLUMN IF NOT EXISTS assunto       VARCHAR(255)`;
  await sql`ALTER TABLE processos ADD COLUMN IF NOT EXISTS relato        TEXT`;
  await sql`ALTER TABLE processos ADD COLUMN IF NOT EXISTS responsavel_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL`;
  await sql`ALTER TABLE processos ADD COLUMN IF NOT EXISTS resultado     TEXT`;
  await sql`ALTER TABLE processos ADD COLUMN IF NOT EXISTS fase_workflow VARCHAR(20) DEFAULT 'pre_contrato'`;
  await sql`ALTER TABLE processos ADD COLUMN IF NOT EXISTS fase_precontrato_at TIMESTAMPTZ DEFAULT NOW()`;
  await sql`ALTER TABLE processos ADD COLUMN IF NOT EXISTS fase_elaboracao_at  TIMESTAMPTZ`;
  await sql`ALTER TABLE processos ADD COLUMN IF NOT EXISTS fase_arquivado_at   TIMESTAMPTZ`;
  console.log("✓ Colunas adicionadas a processos");

  // ── Histórico / Linha do Tempo ────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS historico_registros (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      processo_id     UUID REFERENCES processos(id) ON DELETE CASCADE,
      client_id       UUID REFERENCES clients(id)  ON DELETE CASCADE,
      texto           TEXT NOT NULL,
      tipo            VARCHAR(50)  NOT NULL DEFAULT 'Demanda',
      data_referencia DATE,
      situacao        VARCHAR(100),
      destaque        BOOLEAN NOT NULL DEFAULT FALSE,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓ Tabela historico_registros");

  // ── Eventos / Controles ───────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS eventos_controles (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      processo_id     UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
      titulo          VARCHAR(255) NOT NULL,
      tipo            VARCHAR(50),
      data            DATE,
      hora            TIME,
      local           VARCHAR(255),
      link_virtual    VARCHAR(500),
      responsavel_id  UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓ Tabela eventos_controles");

  // ── Tarefas do Processo ───────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS tarefas_processo (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
      client_id   UUID REFERENCES clients(id) ON DELETE CASCADE,
      titulo      VARCHAR(255) NOT NULL,
      responsavel VARCHAR(100),
      prioridade  VARCHAR(20) NOT NULL DEFAULT 'Normal',
      prazo       DATE,
      hora        TIME,
      comentarios TEXT,
      status      VARCHAR(20) NOT NULL DEFAULT 'pendente',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓ Tabela tarefas_processo");

  // ── Pendências do Cliente ─────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS pendencias_cliente (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      processo_id UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
      client_id   UUID REFERENCES clients(id) ON DELETE CASCADE,
      descricao   TEXT NOT NULL,
      status      VARCHAR(20) NOT NULL DEFAULT 'pendente',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  console.log("✓ Tabela pendencias_cliente");

  console.log("\n✅ Migração concluída.");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
