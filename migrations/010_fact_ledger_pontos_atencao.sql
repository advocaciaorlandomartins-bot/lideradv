-- =============================================================================
-- Migração 010 — Fact Ledger + Pontos de Atenção (Fase 1, passos 2 e 5)
-- Execute este script no painel SQL do Neon antes de subir o código.
-- =============================================================================

-- ─── 1. fatos_caso — Fact Ledger: cada fato extraído, ligado à origem ────────
CREATE TABLE IF NOT EXISTS fatos_caso (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id   UUID          NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  campo         TEXT          NOT NULL,         -- 'cid_principal', 'nis', etc.
  valor         TEXT          NOT NULL,
  documento_id  UUID          REFERENCES documentos(id) ON DELETE SET NULL,
  pagina        INTEGER,                         -- NULL = não rastreado ainda
  trecho        TEXT,                            -- NULL = não rastreado ainda
  status        TEXT          NOT NULL DEFAULT 'documental'
                CHECK (status IN ('confirmado', 'documental', 'alegado', 'ausente', 'conflitante')),
  extraido_por  TEXT          NOT NULL,          -- 'dr_lex_auto', 'manual', etc.
  criado_em     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fatos_caso_processo ON fatos_caso(processo_id);
CREATE INDEX IF NOT EXISTS idx_fatos_caso_campo ON fatos_caso(processo_id, campo);

-- ─── 2. pontos_atencao — alertas determinísticos (regra de código, não IA) ───
CREATE TABLE IF NOT EXISTS pontos_atencao (
  id            UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id   UUID          NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  codigo        TEXT          NOT NULL,          -- 'bpc_acumulacao', 'bpc_impedimento_prazo', ...
  gravidade     TEXT          NOT NULL CHECK (gravidade IN ('impeditivo', 'alto', 'medio', 'baixo')),
  descricao     TEXT          NOT NULL,
  base_legal    TEXT,                            -- 'Lei 8.742/1993, art. 20, § 4º'
  resolvido     BOOLEAN       NOT NULL DEFAULT false,
  resolvido_por UUID,
  resolvido_em  TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (processo_id, codigo)
);

CREATE INDEX IF NOT EXISTS idx_pontos_atencao_processo ON pontos_atencao(processo_id);
CREATE INDEX IF NOT EXISTS idx_pontos_atencao_nao_resolvido ON pontos_atencao(processo_id) WHERE resolvido = false;
