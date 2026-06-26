/**
 * GET /api/db/migrate
 * Aplica migrações idempotentes no banco de dados.
 * Requer sessão autenticada. Chamar uma vez após deploy.
 */

import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const migrations: { name: string; ok: boolean; error?: string }[] = [];

  async function run(name: string, query: () => Promise<unknown>) {
    try {
      await query();
      migrations.push({ name, ok: true });
    } catch (err) {
      migrations.push({ name, ok: false, error: String(err) });
    }
  }

  await run(
    "crm_leads.contrato_id",
    () => sql`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS contrato_id TEXT`
  );

  await run(
    "crm_leads.contrato_status",
    () =>
      sql`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS contrato_status TEXT`
  );

  // Adiciona CHECK constraint apenas se a coluna ainda não a tem
  await run(
    "crm_leads.contrato_status CHECK",
    () =>
      sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'crm_leads_contrato_status_check'
        ) THEN
          ALTER TABLE crm_leads
            ADD CONSTRAINT crm_leads_contrato_status_check
            CHECK (contrato_status IN ('aguardando_assinatura', 'assinado'));
        END IF;
      END $$
    `
  );

  await run(
    "crm_leads.contrato_url",
    () => sql`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS contrato_url TEXT`
  );

  await run(
    "crm_leads.contrato_assinado_em",
    () =>
      sql`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS contrato_assinado_em TIMESTAMPTZ`
  );

  await run(
    "processos.deleted_at",
    () =>
      sql`ALTER TABLE processos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`
  );

  await run(
    "clients.deleted_at",
    () =>
      sql`ALTER TABLE clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`
  );

  await run(
    "password_reset_tokens",
    () => sql`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        token      TEXT PRIMARY KEY,
        usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL,
        used       BOOLEAN NOT NULL DEFAULT FALSE
      )
    `
  );

  await run(
    "crm_leads.prevbot_lead_id",
    () =>
      sql`ALTER TABLE crm_leads ADD COLUMN IF NOT EXISTS prevbot_lead_id TEXT`
  );

  await run(
    "prevbot_webhook_log",
    () => sql`
      CREATE TABLE IF NOT EXISTS prevbot_webhook_log (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        evento          TEXT NOT NULL,
        crm_lead_id     UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
        prevbot_lead_id TEXT,
        telefone        TEXT,
        payload         JSONB,
        status          TEXT NOT NULL DEFAULT 'pendente',
        tentativas      INT  NOT NULL DEFAULT 0,
        ultimo_erro     TEXT,
        enviado_em      TIMESTAMPTZ,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(evento, crm_lead_id)
      )
    `
  );

  const allOk = migrations.every((m) => m.ok);

  return NextResponse.json({
    ok: allOk,
    migrations,
    message: allOk
      ? "Todas as migrações aplicadas com sucesso."
      : "Algumas migrações falharam — veja 'migrations' para detalhes.",
  });
}
