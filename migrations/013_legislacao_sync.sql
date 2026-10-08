-- =============================================================================
-- Migração 013 — Legislação Sync (Fase 3, "legislação-sync" do plano
-- previdenciário, escopo: LOAS/BPC idoso+deficiência/autismo e
-- salário-maternidade). Registra quando o texto oficial de um dispositivo
-- já cadastrado na Base Legal Viva parece ter mudado na fonte oficial —
-- NUNCA sobrescreve o texto sozinho, só alerta pra revisão humana.
-- =============================================================================

CREATE TABLE IF NOT EXISTS legislacao_sync_alertas (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  norma        TEXT         NOT NULL,
  caminho      TEXT         NOT NULL,
  detectado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  resolvido    BOOLEAN      NOT NULL DEFAULT false,
  resolvido_em TIMESTAMPTZ,
  UNIQUE (norma, caminho, resolvido)
);
