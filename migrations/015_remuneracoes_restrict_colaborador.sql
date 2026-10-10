-- Achado em auditoria de 2026-10-10: remuneracoes.colaborador_id tinha
-- ON DELETE CASCADE — excluir um colaborador (fluxo normal de desligamento)
-- apagava silenciosamente TODO o histórico de remuneração dele, inclusive
-- pagamentos já efetuados (status='pago'), e por tabela os lançamentos do
-- livro-caixa espelhados dessas remunerações — sem nenhum registro de
-- auditoria do que foi removido, distorcendo relatórios financeiros/fluxo
-- de caixa passados.
--
-- deleteColaboradorAction (src/lib/colaborador-actions.ts) já tem um catch
-- genérico que mostra "Ele pode ter processos, remunerações ou
-- compromissos vinculados" — escrito como se a exclusão já fosse
-- bloqueada por FK, mas o CASCADE fazia o DELETE sempre funcionar, calado.
-- RESTRICT faz esse catch existente passar a disparar de verdade: a
-- exclusão do colaborador passa a falhar com erro, preservando o
-- histórico financeiro (inativar o colaborador continua sendo o caminho
-- certo pra desligamento, via status='inativo', já suportado na tela).
ALTER TABLE remuneracoes
  DROP CONSTRAINT remuneracoes_colaborador_id_fkey;

ALTER TABLE remuneracoes
  ADD CONSTRAINT remuneracoes_colaborador_id_fkey
  FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id)
  ON DELETE RESTRICT;
