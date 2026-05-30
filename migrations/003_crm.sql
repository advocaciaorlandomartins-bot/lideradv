-- =============================================================================
-- Migração 003 — Módulo CRM
-- =============================================================================

-- Leads (potenciais clientes)
CREATE TABLE IF NOT EXISTS crm_leads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            VARCHAR(255) NOT NULL,
  email           VARCHAR(255),
  telefone        VARCHAR(50),
  tipo            VARCHAR(10)  NOT NULL DEFAULT 'PF' CHECK (tipo IN ('PF', 'PJ')),
  empresa         VARCHAR(255),
  area_interesse  VARCHAR(255),
  estagio         VARCHAR(50)  NOT NULL DEFAULT 'novo_contato'
                               CHECK (estagio IN ('novo_contato','consulta_agendada','em_analise','proposta_enviada','fechado','perdido')),
  origem          VARCHAR(100),
  responsavel_id  UUID         REFERENCES colaboradores(id) ON DELETE SET NULL,
  client_id       UUID         REFERENCES clients(id) ON DELETE SET NULL,
  notas           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_leads_estagio_idx       ON crm_leads(estagio);
CREATE INDEX IF NOT EXISTS crm_leads_responsavel_idx   ON crm_leads(responsavel_id);
CREATE INDEX IF NOT EXISTS crm_leads_client_idx        ON crm_leads(client_id);

-- Atividades / Interações
CREATE TABLE IF NOT EXISTS crm_atividades (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID        NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  tipo            VARCHAR(50) NOT NULL
                              CHECK (tipo IN ('ligacao','email','reuniao','whatsapp','visita','outro')),
  titulo          VARCHAR(255) NOT NULL,
  descricao       TEXT,
  data_hora       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responsavel_id  UUID        REFERENCES colaboradores(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_atividades_lead_idx ON crm_atividades(lead_id);

-- Tarefas / Follow-ups
CREATE TABLE IF NOT EXISTS crm_tarefas (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID        NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  titulo           VARCHAR(255) NOT NULL,
  descricao        TEXT,
  data_vencimento  DATE,
  concluida        BOOLEAN     NOT NULL DEFAULT FALSE,
  responsavel_id   UUID        REFERENCES colaboradores(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_tarefas_lead_idx      ON crm_tarefas(lead_id);
CREATE INDEX IF NOT EXISTS crm_tarefas_vencimento_idx ON crm_tarefas(data_vencimento);
