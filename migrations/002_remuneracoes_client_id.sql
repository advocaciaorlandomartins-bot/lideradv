-- =============================================================================
-- Migração 002 — Adicionar client_id em remuneracoes
-- =============================================================================

ALTER TABLE remuneracoes
  ADD COLUMN IF NOT EXISTS client_id UUID DEFAULT NULL
    REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS remuneracoes_client_id_idx ON remuneracoes(client_id);
