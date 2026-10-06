-- =============================================================================
-- Migração 006 — Tamanho de fonte por modelo (override opcional)
-- Execute este script no painel SQL do Neon antes de subir o código.
-- =============================================================================

ALTER TABLE modelos_documento ADD COLUMN IF NOT EXISTS fonte_tamanho SMALLINT;
