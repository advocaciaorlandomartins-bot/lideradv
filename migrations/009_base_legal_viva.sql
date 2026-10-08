-- =============================================================================
-- Migração 009 — Base Legal Viva (Fase 1, passo 1 do pacote especialista)
-- fontes_legais + dispositivos: textos oficiais versionados, com hash pra
-- detectar mudança e rastreio de qual lei alterou cada parágrafo.
-- Execute este script no painel SQL do Neon antes de subir o código.
-- =============================================================================

-- ─── 1. fontes_legais — normas cadastradas (uma linha por lei/decreto) ───────
CREATE TABLE IF NOT EXISTS fontes_legais (
  id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  norma             TEXT          NOT NULL,        -- 'Lei 8.742/1993'
  apelido           TEXT,                           -- 'LOAS'
  url_oficial       TEXT          NOT NULL,
  hash_texto        TEXT          NOT NULL,          -- sha256 do texto bruto coletado
  coletado_em       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  status            TEXT          NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'revogada', 'desatualizada')),
  UNIQUE (norma)
);

-- ─── 2. dispositivos — artigo/parágrafo/inciso, com redação e vigência ───────
CREATE TABLE IF NOT EXISTS dispositivos (
  id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  fonte_id          UUID          NOT NULL REFERENCES fontes_legais(id) ON DELETE CASCADE,
  caminho           TEXT          NOT NULL,          -- 'art. 20, § 2º'
  texto             TEXT          NOT NULL,          -- texto literal do dispositivo
  redacao_dada_por  TEXT,                            -- 'Lei nº 13.146, de 2015'
  vigente_de        DATE,                            -- NULL = data exata não confirmada ainda
  vigente_ate       DATE,
  revogado          BOOLEAN       NOT NULL DEFAULT false,
  observacao        TEXT,                            -- ex.: 'VETADO', 'pendente de vigência condicionada'
  hash_texto        TEXT          NOT NULL,
  verificado_em     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (fonte_id, caminho)
);

CREATE INDEX IF NOT EXISTS idx_dispositivos_fonte ON dispositivos(fonte_id);
CREATE INDEX IF NOT EXISTS idx_dispositivos_revogado ON dispositivos(revogado);
