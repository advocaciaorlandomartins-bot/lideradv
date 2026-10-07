-- =============================================================================
-- Migração 008 — Logo do sistema (sidebar, login, ícone do app) configurável
-- Execute este script no painel SQL do Neon antes de subir o código.
-- =============================================================================

ALTER TABLE escritorio_config ADD COLUMN IF NOT EXISTS logo_app_url TEXT;
ALTER TABLE escritorio_config ADD COLUMN IF NOT EXISTS logo_app_icon_url TEXT;
