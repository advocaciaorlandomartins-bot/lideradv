# Pacote LiderAdv — Especialista Previdenciário 24h

## Como usar (3 passos)

1. Coloque esta pasta inteira dentro do repositório do LiderAdv (por exemplo em `docs/pacote-especialista/`).
2. No Claude Code, digite:
   > Leia `docs/pacote-especialista/00-LEIA-PRIMEIRO.md` e `01-PROMPT-MESTRE-CLAUDE-CODE.md` e execute a Fase 0. Não altere nada antes de me mostrar a auditoria técnica.
3. Aprove fase por fase (0 a 4). O Claude Code para ao fim de cada uma.

## O que há aqui

| Arquivo                           | Para quê                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `01-PROMPT-MESTRE-CLAUDE-CODE.md` | Instruções completas: regras invioláveis, arquitetura, agentes, jobs 24h, fases com critérios de aceite, testes              |
| `02-RELATORIO-AUDITORIA.md`       | O que encontrei no sistema, com evidências e fontes                                                                          |
| `agentes/juiz-revisor.md`         | **Juiz Revisor adversarial** (lente juiz + lente procurador do INSS): checklists, schema de saída, regras de parecer, prompt |
| `agentes/auditor-citacoes.md`     | Portão que bloqueia peça com citação não verificada                                                                          |
| `agentes/redator-peticao.md`      | Redator que só usa fatos, lei e precedentes verificados                                                                      |
| `db/schema.sql`                   | Esquema de referência (Base Legal, Jurisprudência, Fact Ledger, peças, citações, auditoria, kill switch)                     |
| `jobs/jobs-24h.md`                | Jobs diários/semanais (legislação, jurisprudência, prazos, movimentações, relatório)                                         |
| `tests/golden-set.json`           | 14 casos de regressão sintéticos (inclui os erros achados no processo auditado)                                              |
| `skills/*/SKILL.md`               | Três skills para usar aqui no Claude: juiz revisor, verificador de citações, petição verificada                              |

## Ordem de prioridade (resumo)

Fase 1 remove as brechas: Base Legal Viva + Fact Ledger + Citation Gate + Pontos de Atenção + bloqueios. Fase 2 traz jurisprudência viva e o Juiz Revisor integrado. Fase 3 liga os jobs 24h. Fase 4 liga o aprendizado com freio e as métricas.

## Avisos importantes

- Nenhum sistema garante ganhar todos os processos. O pacote elimina brechas **evitáveis** (lei revogada, precedente inexistente, prazo perdido, prova faltando, contradição ignorada).
- Itens marcados "a validar/confirmar na fonte" (ex.: status do Tema 385 da TNU; detalhes da API do DataJud) precisam ser conferidos em portal oficial antes de virar regra.
- A IA nunca protocola nem envia nada sozinha. Aprovação do advogado é obrigatória.
- Dados reais de clientes não entram em testes, logs, prompts versionados nem neste pacote.
- Toda minuta é apoio ao advogado, que responde pela peça.
