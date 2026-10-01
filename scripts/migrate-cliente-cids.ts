import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

// Substitui o modelo de "um CID só" (clients.cid_principal, preenchido uma
// vez e nunca mais atualizado) por uma lista — um documento médico real
// costuma trazer vários CIDs de uma vez (ex: atestado com "I61 + I11.9 +
// E10.4 + I42.2") e o mesmo cliente pode ter documentos de condições
// completamente diferentes (cardio x ortopédico) vindos de médicos
// diferentes. clients.cid_principal continua existindo (não quebra nada
// que já usa), essa tabela é a fonte de verdade nova.
async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS cliente_cids (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      cid             TEXT NOT NULL,
      descricao       TEXT,
      medico_nome     TEXT,
      medico_crm      TEXT,
      data_documento  DATE,
      documento_id    UUID REFERENCES documentos(id) ON DELETE SET NULL,
      origem          TEXT NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'ia', 'prevbot')),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_cliente_cids_client ON cliente_cids (client_id)
  `;
  console.log("✓ Tabela cliente_cids");
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
