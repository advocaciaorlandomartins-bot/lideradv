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
