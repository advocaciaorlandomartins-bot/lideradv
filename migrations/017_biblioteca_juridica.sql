-- =============================================================================
-- Migração 017 — Biblioteca Jurídica: repositório de petições-modelo (peças
-- reais escritas pelo escritório, usadas como referência de estilo/
-- argumentação) e precedentes favoráveis (sentenças/acórdãos) enviados por
-- upload. A IA lê o PDF, classifica e extrai os dados; um humano (admin)
-- revisa e aprova antes de qualquer coisa entrar de fato em ia_peticoes ou
-- em precedentes (mesma cautela já documentada na migração 014 — jamais
-- "resumido por IA" sem verificação humana).
-- =============================================================================

CREATE TABLE IF NOT EXISTS biblioteca_juridica (
  id                    UUID         DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Arquivo (Vercel Blob, mesmo padrão de `documentos`, mas sem dono —
  -- processo/cliente — porque é um documento de referência do escritório
  -- inteiro, não de um caso específico).
  nome                  TEXT         NOT NULL,
  nome_original         TEXT         NOT NULL,
  tipo                  TEXT         NOT NULL,
  tamanho               BIGINT,
  caminho               TEXT         NOT NULL,
  url                   TEXT         NOT NULL,

  -- Classificação + extração pela IA (sempre revisável antes de aprovar).
  categoria             TEXT         CHECK (categoria IN ('modelo_peticao', 'precedente', 'outro')),
  status                TEXT         NOT NULL DEFAULT 'processando'
                                       CHECK (status IN ('processando', 'pendente_revisao', 'aprovado', 'rejeitado', 'erro')),
  erro_classificacao    TEXT,

  -- Campos extraídos — usados conforme a categoria (modelo usa
  -- area/tipo_peticao/resumo/texto_extraido; precedente usa
  -- tribunal/identificacao/tese/beneficios_aplicaveis).
  resumo                TEXT,
  area                  TEXT,
  tipo_peticao          TEXT,
  tribunal              TEXT,
  identificacao         TEXT,
  tese                  TEXT,
  beneficios_aplicaveis TEXT[]       NOT NULL DEFAULT '{}',
  texto_extraido        TEXT,

  -- Rastro de quem enviou/revisou e pra onde foi (depois de aprovado).
  enviado_por           UUID         REFERENCES usuarios(id) ON DELETE SET NULL,
  revisado_por          UUID         REFERENCES usuarios(id) ON DELETE SET NULL,
  revisado_em           TIMESTAMPTZ,
  precedente_id         UUID         REFERENCES precedentes(id) ON DELETE SET NULL,
  ia_peticao_id         UUID         REFERENCES ia_peticoes(id) ON DELETE SET NULL,

  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_biblioteca_status ON biblioteca_juridica (status, created_at DESC);
