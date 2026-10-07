-- =============================================================================
-- Migração 007 — Contrato de Parceria entre Advogados
-- Execute este script no painel SQL do Neon antes de subir o código.
-- =============================================================================

-- Envelope de assinatura pode ser enviado pra um colaborador (contrato de
-- parceria) em vez de um cliente — client_id já era nullable, colaborador_id
-- é o par dele.
ALTER TABLE envelopes ADD COLUMN IF NOT EXISTS colaborador_id UUID REFERENCES colaboradores(id);

-- Congela o % de comissão vigente no momento em que o protocolo
-- administrativo/distribuição judicial é registrado — uma mudança futura no
-- percentual do colaborador não altera processos já em andamento.
ALTER TABLE processos ADD COLUMN IF NOT EXISTS comissao_pct_snapshot JSONB;

-- Garante no banco que um envelope nunca aponta pros dois ao mesmo tempo
-- (achado de revisão: só existia como comentário no código, sem garantia
-- real de integridade).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'envelopes_client_ou_colaborador'
  ) THEN
    ALTER TABLE envelopes
    ADD CONSTRAINT envelopes_client_ou_colaborador
    CHECK (client_id IS NULL OR colaborador_id IS NULL);
  END IF;
END $$;
