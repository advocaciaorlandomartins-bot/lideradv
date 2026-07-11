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
  if (session.categoria !== "Administrador(a)") {
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 }
    );
  }

  const migrations: { name: string; ok: boolean; error?: string }[] = [];

  async function run(name: string, query: () => Promise<unknown>) {
    try {
      await query();
      migrations.push({ name, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Mask internal details in production
      const safeMsg =
        process.env.NODE_ENV === "production"
          ? msg.replace(
              /\b(?:password|secret|key|token)\b[^\s]*/gi,
              "[redacted]"
            )
          : msg;
      migrations.push({ name, ok: false, error: safeMsg });
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

  await run(
    "lgpd_solicitacoes",
    () => sql`
      CREATE TABLE IF NOT EXISTS lgpd_solicitacoes (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tipo         TEXT        NOT NULL,
        entidade     TEXT        NOT NULL,
        entidade_id  TEXT,
        motivo       TEXT,
        executado_por TEXT       NOT NULL DEFAULT 'sistema',
        executado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
  );

  await run(
    "ia_peticoes",
    () => sql`
      CREATE TABLE IF NOT EXISTS ia_peticoes (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        area         TEXT        NOT NULL,
        tipo_peticao TEXT        NOT NULL,
        titulo       TEXT        NOT NULL,
        texto        TEXT        NOT NULL,
        resumo       TEXT,
        tags         TEXT[]      NOT NULL DEFAULT '{}',
        aprovada     BOOLEAN     NOT NULL DEFAULT FALSE,
        vezes_usada  INTEGER     NOT NULL DEFAULT 0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
  );

  await run(
    "ia_peticoes.idx_area",
    () => sql`
      CREATE INDEX IF NOT EXISTS ia_peticoes_area_idx ON ia_peticoes (area, aprovada)
    `
  );

  await run(
    "ia_peticoes.processo_id",
    () =>
      sql`ALTER TABLE ia_peticoes ADD COLUMN IF NOT EXISTS processo_id UUID REFERENCES processos(id) ON DELETE SET NULL`
  );

  await run(
    "ia_peticoes.cliente_id",
    () =>
      sql`ALTER TABLE ia_peticoes ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clients(id) ON DELETE SET NULL`
  );

  await run(
    "ia_peticoes.idx_processo",
    () =>
      sql`CREATE INDEX IF NOT EXISTS ia_peticoes_processo_idx ON ia_peticoes (processo_id) WHERE processo_id IS NOT NULL`
  );

  await run(
    "testes_comportamentais",
    () => sql`
      CREATE TABLE IF NOT EXISTS testes_comportamentais (
        id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        nome_candidato  TEXT        NOT NULL,
        cargo_vaga      TEXT,
        pontuacao_a     INT         NOT NULL DEFAULT 0,
        pontuacao_b     INT         NOT NULL DEFAULT 0,
        pontuacao_c     INT         NOT NULL DEFAULT 0,
        pontuacao_d     INT         NOT NULL DEFAULT 0,
        perfil_dominante TEXT       NOT NULL DEFAULT '',
        funcao_sugerida TEXT        NOT NULL DEFAULT '',
        pontos_fortes   TEXT,
        pontos_atencao  TEXT,
        recomendacao    TEXT        NOT NULL DEFAULT '',
        pergunta_entrevista TEXT,
        respostas       JSONB       NOT NULL DEFAULT '[]',
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by      UUID        REFERENCES usuarios(id) ON DELETE SET NULL
      )
    `
  );

  await run(
    "testes_comportamentais.idx_created_at",
    () =>
      sql`CREATE INDEX IF NOT EXISTS testes_comportamentais_created_at_idx ON testes_comportamentais (created_at DESC)`
  );

  await run(
    "atualizacoes_legais",
    () => sql`
      CREATE TABLE IF NOT EXISTS atualizacoes_legais (
        id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        titulo                TEXT        NOT NULL,
        resumo                TEXT,
        url                   TEXT,
        data_publicacao       DATE        NOT NULL,
        secao_dou             TEXT,
        orgao                 TEXT,
        tipo                  TEXT        NOT NULL DEFAULT 'diario_oficial',
        impacto               TEXT        NOT NULL DEFAULT 'baixo',
        analise_ia            TEXT,
        o_que_muda            TEXT,
        acao_recomendada      TEXT,
        tipos_afetados        TEXT[]      NOT NULL DEFAULT '{}',
        lida                  BOOLEAN     NOT NULL DEFAULT FALSE,
        fonte                 TEXT        NOT NULL DEFAULT 'dou',
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
  );

  await run(
    "atualizacoes_legais.idx_data",
    () =>
      sql`CREATE INDEX IF NOT EXISTS atualizacoes_legais_data_idx ON atualizacoes_legais (data_publicacao DESC, impacto)`
  );

  await run(
    "atualizacoes_legais.idx_lida",
    () =>
      sql`CREATE INDEX IF NOT EXISTS atualizacoes_legais_lida_idx ON atualizacoes_legais (lida) WHERE lida = FALSE`
  );

  await run(
    "compromissos.cliente_id",
    () =>
      sql`ALTER TABLE compromissos ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES clients(id) ON DELETE SET NULL`
  );

  await run(
    "mensagens_config",
    () => sql`
      CREATE TABLE IF NOT EXISTS mensagens_config (
        id         INT  PRIMARY KEY DEFAULT 1,
        config     JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT mensagens_config_single CHECK (id = 1)
      )
    `
  );

  await run(
    "mensagens_config.seed",
    () =>
      sql`INSERT INTO mensagens_config (id, config) VALUES (1, '{}') ON CONFLICT (id) DO NOTHING`
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
