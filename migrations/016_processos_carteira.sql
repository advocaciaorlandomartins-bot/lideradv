-- Achado em auditoria de 2026-10-09/10, construído em 2026-10-10 a pedido
-- do Orlando: "carteira" (categoria/portfólio de processos, usado pra
-- segmentar — ex: "Carteira A", "Campanha X") já aparecia como filtro em
-- Processos ("Nome da carteira…") e como toggle "obrigatório" nas
-- Configurações, mas a coluna nunca existiu — o filtro era mudo (nunca
-- aplicado na query) e o toggle não tinha o que controlar.
ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS carteira VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_processos_carteira
  ON processos (carteira)
  WHERE carteira IS NOT NULL;
