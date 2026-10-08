-- =============================================================================
-- Migração 011 — Kill switch global dos agentes de IA (Fase 3 do pacote)
-- Execute este script no painel SQL do Neon antes de subir o código.
-- =============================================================================

CREATE TABLE IF NOT EXISTS config_agentes (
  chave          TEXT          PRIMARY KEY,
  valor          JSONB         NOT NULL,
  atualizado_em  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  atualizado_por UUID
);

-- Chave usada: 'agentes_ativos' → {"ativo": true}. Ausência de linha =
-- ativo (default seguro: não trava o sistema por engano se a tabela
-- estiver vazia).
