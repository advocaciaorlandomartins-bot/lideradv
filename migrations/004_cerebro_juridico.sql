-- =============================================================================
-- Migração 004 — Cérebro Jurídico (aprendizado autônomo + análises IA)
-- Execute este script no painel SQL do Neon antes de subir o código.
-- Todas as statements usam IF NOT EXISTS (seguro para re-executar).
-- =============================================================================

-- ─── 1. cerebro_juridico — aprendizado extraído de casos encerrados ──────────
CREATE TABLE IF NOT EXISTS cerebro_juridico (
  id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id           UUID          REFERENCES processos(id) ON DELETE SET NULL,
  tipo_acao             TEXT,
  area                  TEXT          NOT NULL DEFAULT 'Previdenciário',
  vara                  TEXT,
  comarca               TEXT,
  resultado_final       TEXT          CHECK (resultado_final IN (
                                        'deferido', 'indeferido', 'parcialmente_deferido'
                                      )),
  motivo_indeferimento  TEXT,
  argumentos_vencedores TEXT[]        NOT NULL DEFAULT '{}',
  erros_cometidos       TEXT[]        NOT NULL DEFAULT '{}',
  teses_utilizadas      TEXT[]        NOT NULL DEFAULT '{}',
  licao                 TEXT,
  resumo_aprendizado    TEXT,
  pontos_chave          TEXT[]        NOT NULL DEFAULT '{}',
  perfil_caso           JSONB         NOT NULL DEFAULT '{}',
  tempo_resolucao_dias  INTEGER,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cerebro_juridico_tipo_area
  ON cerebro_juridico(tipo_acao, area);

CREATE INDEX IF NOT EXISTS idx_cerebro_juridico_resultado
  ON cerebro_juridico(resultado_final);

CREATE INDEX IF NOT EXISTS idx_cerebro_juridico_processo
  ON cerebro_juridico(processo_id);

-- ─── 2. cerebro_teses — catálogo de teses com taxa de sucesso real ───────────
CREATE TABLE IF NOT EXISTS cerebro_teses (
  id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo           TEXT          NOT NULL,
  tese             TEXT          NOT NULL,
  area             TEXT          NOT NULL DEFAULT 'Previdenciário',
  tipo_acao        TEXT,
  base_legal       TEXT[]        NOT NULL DEFAULT '{}',
  tribunais        TEXT[]        NOT NULL DEFAULT '{}',
  taxa_sucesso     NUMERIC(5, 1),
  vezes_aplicada   INTEGER       NOT NULL DEFAULT 0,
  vezes_venceu     INTEGER       NOT NULL DEFAULT 0,
  ativa            BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cerebro_teses_tipo_area
  ON cerebro_teses(tipo_acao, area);

CREATE INDEX IF NOT EXISTS idx_cerebro_teses_taxa
  ON cerebro_teses(taxa_sucesso DESC NULLS LAST);

-- ─── 3. cerebro_analises — análises IA geradas por processo ──────────────────
CREATE TABLE IF NOT EXISTS cerebro_analises (
  id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id           UUID          NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  tipo                  TEXT          NOT NULL,
  -- 'inicial' | 'documento' | 'andamento' | 'estrategia' | 'audiencia'
  titulo                TEXT,
  analise               TEXT,
  risco                 TEXT          CHECK (risco IN ('alto', 'medio', 'baixo')),
  probabilidade_sucesso INTEGER       CHECK (probabilidade_sucesso BETWEEN 0 AND 100),
  proxima_acao          TEXT,
  base_legal            TEXT[]        NOT NULL DEFAULT '{}',
  metadata              JSONB         NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cerebro_analises_processo_tipo
  ON cerebro_analises(processo_id, tipo);

CREATE INDEX IF NOT EXISTS idx_cerebro_analises_created
  ON cerebro_analises(created_at DESC);
