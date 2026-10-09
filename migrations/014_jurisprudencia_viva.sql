-- =============================================================================
-- Migração 014 — Jurisprudência Viva (Fase 2, escopo reduzido a pedido do
-- Orlando: só LOAS/BPC idoso+deficiência/autismo e salário-maternidade).
-- Mesma ideia da Base Legal Viva, mas pra súmula/tema/precedente em vez de
-- artigo de lei — cada linha é um precedente VERIFICADO manualmente contra
-- fonte oficial (não resumido por IA), com a MESMA citação exata que deve
-- aparecer numa petição.
-- =============================================================================

CREATE TABLE IF NOT EXISTS precedentes (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  tribunal        TEXT         NOT NULL,   -- 'STF', 'STJ', 'TNU', 'TFR', 'CRPS'
  identificacao   TEXT         NOT NULL,   -- 'Tema 27', 'Súmula 456', 'RE 626.489/SE'
  tese            TEXT         NOT NULL,   -- texto da tese/entendimento, verificado
  beneficios      TEXT[]       NOT NULL DEFAULT '{}', -- códigos B relevantes, ex: {'B87','B88'}
  status          TEXT         NOT NULL DEFAULT 'vigente' CHECK (status IN ('vigente', 'superado')),
  observacao      TEXT,        -- ex.: contexto de modulação de efeitos, data de julgamento
  verificado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tribunal, identificacao)
);

CREATE INDEX IF NOT EXISTS idx_precedentes_beneficios ON precedentes USING GIN (beneficios);
