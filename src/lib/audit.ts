import sql from "./db";
import { getSession } from "./session";

// Creates audit_logs table on first call (idempotent DDL).
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      user_login   TEXT        NOT NULL DEFAULT 'sistema',
      user_cat     TEXT,
      acao         TEXT        NOT NULL,
      entidade     TEXT        NOT NULL,
      entidade_id  TEXT,
      descricao    TEXT,
      detalhes     JSONB,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_audit_created
    ON audit_logs (created_at DESC)
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_audit_user
    ON audit_logs (user_login)
  `;
}

let ready = false;

/**
 * Records an audit event.
 * Falls back silently — never throws, never breaks the calling action.
 */
export async function logAction(params: {
  acao: string;
  entidade: string;
  entidadeId?: string;
  descricao?: string;
  detalhes?: Record<string, unknown>;
  /** Pass explicitly when session is not available (e.g. login event). */
  _login?: string;
  _cat?: string;
}) {
  try {
    if (!ready) {
      await ensureTable();
      ready = true;
    }

    let login = params._login;
    let cat = params._cat ?? null;

    if (!login) {
      const session = await getSession();
      login = session?.login ?? "sistema";
      cat = session?.categoria ?? null;
    }

    await sql`
      INSERT INTO audit_logs
        (user_login, user_cat, acao, entidade, entidade_id, descricao, detalhes)
      VALUES
        (${login}, ${cat},
         ${params.acao}, ${params.entidade},
         ${params.entidadeId ?? null},
         ${params.descricao ?? null},
         ${params.detalhes ? JSON.stringify(params.detalhes) : null}::jsonb)
    `;
  } catch (err) {
    console.error("[audit]", err);
  }
}
