import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL!);

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS envelopes (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      nome         VARCHAR(255) NOT NULL,
      prazo        TIMESTAMPTZ,
      status       VARCHAR(50)  NOT NULL DEFAULT 'rascunho'
                   CHECK (status IN ('rascunho','aguardando','concluido','expirado','cancelado')),
      notif_assinantes  BOOLEAN NOT NULL DEFAULT true,
      notif_criador     BOOLEAN NOT NULL DEFAULT true,
      notif_escritorio  BOOLEAN NOT NULL DEFAULT false,
      criado_por   VARCHAR(255),
      criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS envelope_documentos (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      envelope_id  UUID NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
      nome         VARCHAR(255) NOT NULL,
      tamanho_bytes INT,
      ordem        INT NOT NULL DEFAULT 1,
      criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS envelope_assinantes (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      envelope_id     UUID NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
      tipo            VARCHAR(50) NOT NULL
                      CHECK (tipo IN ('eu_mesmo','colaborador','cliente','outro')),
      nome            VARCHAR(255) NOT NULL,
      email           VARCHAR(255) NOT NULL,
      papel           VARCHAR(50) NOT NULL DEFAULT 'assinante'
                      CHECK (papel IN ('assinante','testemunha','avalista')),
      val_email       BOOLEAN NOT NULL DEFAULT true,
      val_selfie      BOOLEAN NOT NULL DEFAULT false,
      val_documento   BOOLEAN NOT NULL DEFAULT false,
      ordem           INT NOT NULL DEFAULT 1,
      status          VARCHAR(50) NOT NULL DEFAULT 'pendente',
      token           VARCHAR(128) UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
      assinado_em     TIMESTAMPTZ,
      criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_envelopes_status    ON envelopes(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_envelopes_criado_por ON envelopes(criado_por)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_env_docs_envelope   ON envelope_documentos(envelope_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_env_ass_envelope    ON envelope_assinantes(envelope_id)`;

  console.log("✅ Migração de assinaturas concluída.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
