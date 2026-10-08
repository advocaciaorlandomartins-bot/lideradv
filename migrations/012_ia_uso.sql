-- =============================================================================
-- Migração 012 — Uso de IA (Fase 3, "limite de custo" do plano previdenciário)
-- Registra tokens consumidos por chamada à Anthropic, pra dar visibilidade de
-- custo sem depender de olhar o console.anthropic.com manualmente. Execute
-- este script no painel SQL do Neon antes de subir o código.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ia_uso (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  rota            TEXT         NOT NULL,        -- '/api/ia/peticao', '/api/cerebro/analisar', etc.
  modelo          TEXT         NOT NULL,
  input_tokens    INTEGER      NOT NULL DEFAULT 0,
  output_tokens   INTEGER      NOT NULL DEFAULT 0,
  usuario_id      UUID,
  criado_em       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ia_uso_criado_em ON ia_uso(criado_em);
