-- =============================================================================
-- Migração 005 — Checklist de documentos necessários (Cliente/Processo)
-- Execute este script no painel SQL do Neon antes de subir o código.
-- Todas as statements usam IF NOT EXISTS (seguro para re-executar).
-- =============================================================================

ALTER TABLE clients   ADD COLUMN IF NOT EXISTS checklist JSONB;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS checklist JSONB;
