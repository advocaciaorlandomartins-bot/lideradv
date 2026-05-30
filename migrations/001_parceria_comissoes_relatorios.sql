-- =============================================================================
-- Migração 001 — Parceria/Origem, Comissões e Metas
-- Execute este script no painel SQL do Neon antes de subir o código.
-- Todas as colunas usam ADD COLUMN IF NOT EXISTS (seguro para re-executar).
-- =============================================================================

-- ─── 1. Estender a tabela clients com campos estruturados de origem ───────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS origem_tipo        VARCHAR(30)   DEFAULT NULL,
  -- 'rede_social' | 'indicacao' | 'trafego_pago' | 'outros'

  ADD COLUMN IF NOT EXISTS origem_texto       TEXT          DEFAULT NULL,
  -- preenchido quando origem_tipo = 'outros'

  ADD COLUMN IF NOT EXISTS indicador_id       UUID          DEFAULT NULL
    REFERENCES colaboradores(id) ON DELETE SET NULL,
  -- colaborador que fez a indicação (quando origem_tipo = 'indicacao')

  ADD COLUMN IF NOT EXISTS indicador_tipo_trabalho VARCHAR(20) DEFAULT NULL,
  -- 'administrativo' | 'judicial' | 'ambos'  (para advogados indicadores)

  ADD COLUMN IF NOT EXISTS comissao_tipo      VARCHAR(20)   DEFAULT NULL,
  -- 'percentual' | 'valor'

  ADD COLUMN IF NOT EXISTS comissao_valor     NUMERIC(10,2) DEFAULT NULL;
  -- percentual (ex: 10.00) ou valor fixo (ex: 500.00)

-- ─── 2. Tabela de configurações de comissões e bonificações ──────────────────
CREATE TABLE IF NOT EXISTS comissoes_config (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                VARCHAR(150)  NOT NULL,
  -- Identificação da regra (ex: "Comissão Advogado Judicial")

  tipo_origem         VARCHAR(30)   DEFAULT NULL,
  -- NULL = aplica-se a todos | 'indicacao' | 'rede_social' | 'trafego_pago' | 'outros'

  cargo_colaborador   VARCHAR(50)   DEFAULT NULL,
  -- NULL = todos | 'advogado' | 'comercial' | 'agente' | etc.

  tipo_trabalho       VARCHAR(20)   DEFAULT NULL,
  -- NULL = não se aplica | 'administrativo' | 'judicial' | 'ambos'

  comissao_tipo       VARCHAR(20)   NOT NULL DEFAULT 'percentual',
  -- 'percentual' | 'valor'

  comissao_valor      NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- percentual (ex: 10.00) ou valor fixo (ex: 500.00)

  bonificacao_tipo    VARCHAR(20)   DEFAULT NULL,
  -- NULL = sem bonificação | 'percentual' | 'valor'

  bonificacao_valor   NUMERIC(10,2) DEFAULT NULL,

  ativo               BOOLEAN       NOT NULL DEFAULT TRUE,
  observacoes         TEXT          DEFAULT NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── 3. Tabela de metas por colaborador ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS metas (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id          UUID          NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  descricao               VARCHAR(200)  NOT NULL,

  tipo                    VARCHAR(30)   NOT NULL DEFAULT 'valor',
  -- 'valor' | 'processos' | 'clientes' | 'indicacoes'

  valor_meta              NUMERIC(12,2) NOT NULL,
  periodo                 VARCHAR(20)   NOT NULL DEFAULT 'mensal',
  -- 'mensal' | 'trimestral' | 'anual'

  competencia             VARCHAR(7)    NOT NULL,
  -- formato 'YYYY-MM'

  valor_realizado         NUMERIC(12,2) NOT NULL DEFAULT 0,

  bonificacao_config_id   UUID          DEFAULT NULL
    REFERENCES comissoes_config(id) ON DELETE SET NULL,

  status                  VARCHAR(20)   NOT NULL DEFAULT 'ativo',
  -- 'ativo' | 'concluido' | 'cancelado'

  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── 4. Rastreamento de parceria nos lançamentos ─────────────────────────────
ALTER TABLE lancamentos
  ADD COLUMN IF NOT EXISTS origem_client_id             UUID DEFAULT NULL
    REFERENCES clients(id) ON DELETE SET NULL,
  -- cliente cuja parceria gerou este lançamento de comissão

  ADD COLUMN IF NOT EXISTS comissao_config_id           UUID DEFAULT NULL
    REFERENCES comissoes_config(id) ON DELETE SET NULL,
  -- regra de comissão aplicada

  ADD COLUMN IF NOT EXISTS comissao_gerada_lancamento_id UUID DEFAULT NULL;
  -- ID do lançamento de comissão gerado automaticamente (auto-referência)

-- ─── 5. Índices para performance ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clients_origem_tipo    ON clients(origem_tipo);
CREATE INDEX IF NOT EXISTS idx_clients_indicador_id   ON clients(indicador_id);
CREATE INDEX IF NOT EXISTS idx_metas_colaborador      ON metas(colaborador_id, competencia);
CREATE INDEX IF NOT EXISTS idx_comissoes_config_ativo ON comissoes_config(ativo);
CREATE INDEX IF NOT EXISTS idx_lancamentos_origem     ON lancamentos(origem_client_id);
