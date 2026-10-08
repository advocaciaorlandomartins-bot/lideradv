# LiderAdv — Auditoria técnica (Fase 0) + status da Fase 1

Data: 2026-10-07. Baseada em leitura direta do código em `src/`, `migrations/` e `vercel.json` — não em suposição e não no conteúdo de `docs/pacote-especialista/` (que é um **plano proposto, não implementado**; ver seção 8).

## 0. Status da Fase 1 (atualizado 2026-10-08)

| Passo                 | Status                                                                                                                                                                                                                                                                                                                                                                                                                                  | Onde                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1. Base Legal Viva    | Feito — 4 normas, 188 dispositivos: LOAS (50 disp.: BPC completo — requisitos, renda, revisão/suspensão/cessação), Lei 8.213/91 (100 disp.: período de graça, carência, aposentadoria especial, invalidez, auxílio-doença, salário-maternidade, pensão por morte, decadência/prescrição), EC 103/2019 (30 disp.: as 4 regras de transição + pensão por morte pós-reforma), Lei 13.146/2015 (8 disp.: art. 2º, definição de deficiência) | `migrations/009`, `src/lib/base-legal-db.ts`, `scripts/seed-base-legal*.ts`           |
| 2. Fact Ledger        | Feito, sem página/trecho por campo (limitação conhecida)                                                                                                                                                                                                                                                                                                                                                                                | `migrations/010`, `src/lib/fact-ledger-db.ts`                                         |
| 3. Citation Gate      | Feito pra citação de LEI, cobrindo as 4 normas acima; jurisprudência é Fase 2. Parser reescrito depois de 9 bugs reais achados testando (ver lista na seção 0.1)                                                                                                                                                                                                                                                                        | `src/lib/citation-gate.ts`, rodando automático em Gerar Petição                       |
| 4. Reescrever prompts | Feito: Gerar Petição + Cérebro recebem a Base Legal Viva pro benefício certo (mapa completo em `base-legal-db.ts: NORMAS_POR_BENEFICIO`, conferido contra os códigos reais do formulário de cliente); fechada a brecha de "jurisprudência pacífica do TRF5" genérica                                                                                                                                                                    | `ai-juridico-skills.ts`, `ia/peticao/route.ts`, `cerebroJuridico.ts: prepararAnalise` |
| 5. Pontos de Atenção  | BPC (só B87/B88, NÃO B80): acumulação, impedimento de prazo, miserabilidade, CPF, cessação possivelmente indevida. Genérica (qualquer benefício): prescrição quinquenal da DER. Falta: nome divergente                                                                                                                                                                                                                                  | `src/lib/pontos-atencao-db.ts`                                                        |
| 6. Painel na tela     | Feito (pontos de atenção); "estado da peça" (rascunho/bloqueada/aprovada) não existe ainda                                                                                                                                                                                                                                                                                                                                              | `pontos-atencao-panel.tsx`                                                            |

Testado contra `docs/pacote-especialista/tests/golden-set.json` em `scripts/golden-set-test.ts`: 4 dos 14 casos originais têm implementação real testável hoje (T1, T2, T6-equivalente, T7) — todos passando, mais 8 testes de regressão próprios — 12 PASS, 0 FAIL no total. Os outros 10 casos do golden-set original dependem de peças da Fase 2 (Juiz Revisor, Jurisprudência Viva, Auditor Legal por data) ou de partes da Fase 1 ainda não feitas (nome divergente, estado da peça, kill switch, mascaramento LGPD).

**Decisão já tomada com o Orlando:** Citation Gate roda automático e silencioso, só avisa quando acha problema — não bloqueia nada ainda (bloquear hoje ainda pegaria qualquer petição de um benefício fora do mapa de normas cobertas).

**Bug real corrigido em produção (2026-10-08):** B80 (Salário-Maternidade) estava sendo tratado como código de BPC em `pontos-atencao-db.ts` e `base-legal-db.ts` (erro meu, não verificado contra os códigos reais do formulário quando escrevi o motor de regras). 2 processos reais de clientes mostraram um alerta de "faltam dados de miserabilidade" que não tem nada a ver com salário-maternidade. Dados corrigidos em produção, código corrigido, teste de regressão adicionado. Lição: sempre conferir código de benefício contra `new-client-form.tsx`/`edit-client-form.tsx` antes de usar num mapa — é a fonte de verdade real, não suposição.

## 0.1. Bugs reais achados testando o Citation Gate (cronológico)

Lista honesta de cada bug achado enquanto eu mesmo testava o parser contra citações reais (não hipotéticas) — cada um tem teste de regressão permanente em `scripts/golden-set-test.ts`:

1. Inciso citado sem a palavra "inciso" ("art. 15, II") normalizava errado.
2. "art. N" cru sem sub-parte não batia com "art. N, caput" salvo no banco.
3. Duas leis citadas perto uma da outra na mesma frase podiam cruzar o artigo errado.
4. "º" grudado no número do artigo ("art. 2º") quebrava a detecção do que vinha depois.
5. Citação de 3 níveis (artigo + parágrafo + inciso, ex. "art. 2º, §1º, I") nunca batia — o normalizador só sabia 2 níveis.
6. "arts. 57 e 58" (plural) não gerava nenhum match — citação inteira invisível.
7. "art. 20-B" (hífen + letra) não achava o fallback de caput.
8. "parágrafo único" caía pro CAPUT do artigo (verificação contra o dispositivo ERRADO, sem aviso nenhum — o mais sério dos bugs de citação).
9. "§§" duplo (vários parágrafos citados juntos) não gerava nenhum match.

Mais o bug de classificação B80/BPC descrito acima (não é bug do Citation Gate, é do motor de Pontos de Atenção/injeção de prompt).

## 1. Stack real

Next.js 15/16 (App Router) + Neon Postgres (driver serverless `@neondatabase/serverless`, sem sessão persistente entre queries) + Vercel (deploy, Cron, Blob storage). IA: Anthropic Claude API direto via SDK (`@anthropic-ai/sdk`), **sem** wrapper central — 16 arquivos diferentes instanciam `new Anthropic(...)` cada um por conta própria. Modelos em uso: `claude-sonnet-5` (análise, diagnóstico, petição, quesitos, aprendizado) e `claude-haiku-4-5-20251001` (Íris, extração por documento, classificação de notícias — caminhos onde custo/latência importam mais que profundidade).

## 2. Onde vive cada feature de IA

| Feature                            | Prompt                                                                                                                                                                                                                                                                                                                                                          | Modelo                                                                        | Onde grava                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Dr. Lex** (análise de documento) | `src/lib/ai-juridico.ts` (`analisarDocumento`/`analisarDocumentoExtendido`) e uma segunda implementação em `cerebroJuridico.ts` (`analisarDocumento`, usada quando o doc já está num processo)                                                                                                                                                                  | sonnet (haiku como fallback de reextração)                                    | `clients`/`processos` (só campos vazios), `cliente_cids`, `cerebro_analises`                  |
| **Cérebro Jurídico**               | `src/lib/cerebroJuridico.ts` — prompt fixo `BASE_LEGAL` (linhas 20-282, texto estático de lei/súmulas) + `promptModoEspecializado()` (20 modos por tipo de benefício/ação)                                                                                                                                                                                      | sonnet (diagnóstico), haiku (extração por doc), sonnet (aprendizado pós-caso) | `cerebro_analises`, `cerebro_juridico`, `cerebro_teses`, `tarefas_processo`                   |
| **Diagnóstico Estratégico**        | **Duas implementações não convergidas.** A que realmente roda: `CerebroPanel` → `/api/cerebro/analisar` → mesmo Cérebro Jurídico acima. A outra (`IaEstrategiaPanel` → `/api/ia/estrategia` → `ai-juridico.ts: estrategiaProcessual()`) é **código morto** — não é importada em nenhuma página e o resultado nem é salvo em banco (perdido ao atualizar a tela) | sonnet                                                                        | ver acima                                                                                     |
| **Gerar Petição**                  | `src/lib/ai-juridico-skills.ts` (prompts fixos por área: previdenciário, trabalhista etc., cada um com bloco de "jurisprudência dominante" hardcoded) + `gerarPeticaoStream()` em `ai-juridico.ts`                                                                                                                                                              | sonnet, streaming, prompt caching                                             | `ia_peticoes` (banco de petições reutilizáveis — é ranking de reuso, não rastreio de citação) |
| **Quesitos Médicos**               | `src/lib/quesitos-medicos.ts`                                                                                                                                                                                                                                                                                                                                   | sonnet                                                                        | `cerebro_analises` (tipo='quesitos_medicos')                                                  |
| **Íris**                           | `src/app/api/iris/chat/route.ts` + `src/lib/iris-tools.ts` (~25 tools)                                                                                                                                                                                                                                                                                          | haiku (limite de 60s da função serverless)                                    | `iris_conversas`; só **lê** `cerebro_analises`/`atualizacoes_legais`, não escreve             |

## 3. O achado central: não existe verificação de citação em lugar nenhum

Todo o sistema usa o mesmo padrão: **o prompt pede pro modelo não inventar, mas nada confere depois.** Três camadas, todas "honra ao mérito":

1. **Regra escrita no prompt, sem checagem independente.** Exemplos reais do código:
   - `cerebroJuridico.ts:24-29` — "Nunca invente fatos... Cite SEMPRE a base legal exata... Quando uma informação não estiver nos dados, diga 'requer verificação'".
   - `ai-juridico-skills.ts:325` — **a frase mais importante desta auditoria**: _"NUNCA cite jurisprudência inventada. Cite apenas precedentes reconhecidos (com número verdadeiro ou **genérico como 'pacífica jurisprudência do TRF5'**)."_ Isso autoriza por escrito o modelo citar jurisprudência que ele não consegue verificar que existe, desde que a frase seja vaga o suficiente.
   - `iris/chat/route.ts:246` — mesma lógica de honra ao mérito pra Íris.

2. **Texto jurídico fixo, congelado na data em que foi escrito, sem controle de versão/vigência.** `BASE_LEGAL` (`cerebroJuridico.ts:20-282`) é um resumo manual de Lei 8.213/91, Lei 8.742/93, EC 103/2019 e dezenas de súmulas/temas — inclusive valores de salário mínimo/teto do INSS **hardcoded** (linhas 276-277). Isso é exatamente o tipo de coisa que fica desatualizada sem ninguém perceber.

3. **Uma exceção real e genuína** (a única parte do sistema que já puxa de fonte externa de verdade, não da memória do modelo): `atualizacoes_legais` + `/api/cron/atualizacoes-legais` — puxa itens reais do DOU/InLabs e RSS do INSS/gov.br, usa a IA só pra classificar impacto e resumir, preserva a URL original. Mas cobre só notícia regulatória recente (portarias/instruções normativas), não o texto completo de leis nem jurisprudência (súmulas/temas/acórdãos), e não tem conceito de "versão/hash de um artigo específico".

**Conclusão prática:** o pacote `docs/pacote-especialista/` descreve corretamente o problema. A Base Legal Viva, Jurisprudência Viva, Citation Gate e Fact Ledger que ele propõe **não existem hoje** — é 100% a construir.

## 4. Armazenamento de documentos

Arquivo em si: Vercel Blob (upload direto navegador→Blob, até 25MB). Metadado em `documentos` (entity_type/entity_id genérico, serve pra cliente ou processo). Dado extraído do documento se espalha em: colunas de `clients`/`processos` (só preenchidas se estavam vazias — não sobrescreve o que o advogado já editou), e `cliente_cids` (liga um CID ao `documento_id` de origem — **é o único lugar do sistema hoje que já liga um fato específico ao documento que o gerou**, mas só pra CID, sem página/trecho).

## 5. Checklist de documentos por benefício

`src/lib/checklist-documentos.ts` — lista fixa por código de benefício (B80, B87/88 etc.), guardada como JSONB em `clients.checklist`/`processos.checklist`, editável manualmente pelo advogado na tela. **Não tem relação nenhuma com um Fact Ledger** — é só uma lista de check, sem vínculo com documento real enviado nem com o que a IA já analisou.

## 6. Migrações e módulos auxiliares já existentes

`migrations/001` a `008` cobrem: parceria/comissões, CRM, **todo o schema do Cérebro Jurídico** (004), checklist (005), fonte de modelo (006), contrato de parceria (007), logo do app (008). O grosso do schema mais antigo (clients, processos, documentos, cliente_cids, ia_usage_log) foi feito por ~90 scripts avulsos em `scripts/migrate-*.ts`, não pela pasta `migrations/`.

Audiências, Prazos, Perícias (controle de prazo), DCB, Benefícios, Alvarás/RPVs são **um módulo só** (`controles`, tabela com coluna `tipo`) — Perícias também tem um módulo próprio separado pra agendamento em si (histórico: já houve bug de produção por confundir os dois).

Cron: Vercel Cron puro (`vercel.json`), sem fila externa. `/api/cron/orquestrador` roda seg-sáb 14h UTC e dispara, em sequência, publicações/prevbot/prazos/limpeza/atualizações-legais/scheduler do Cérebro, logando cada execução em `cron_execucoes`.

## 7. Não-conformidade que já existe hoje (achado extra, fora do escopo original)

`aprenderComResultado()` (o "aprendizado pós-caso" do Cérebro) tinha um bug de nome de campo que fez com que **nunca tivesse rodado de verdade em produção** — `cerebro_juridico`/`cerebro_teses` estão vazias mesmo com casos reais já encerrados. O código já tem a correção comentada (linha 2543 de `cerebroJuridico.ts`), mas vale confirmar com você se isso já foi corrigido e re-testado, porque hoje não há dado histórico nenhum pra essa tabela alimentar o "Curador do Cérebro" da Fase 4.

## 8. Sobre a pasta `docs/pacote-especialista/`

Copiei o pacote pra dentro do repo como pedido. Ele contém um plano de arquitetura (Base Legal Viva, Jurisprudência Viva, Citation Gate, Fact Ledger, agentes, jobs 24h) que é **sólido e ainda não implementado** — o relatório `02-RELATORIO-AUDITORIA.md` de dentro do pacote avisa na própria linha 5 que foi feito **sem ler o código**, só olhando a tela de um processo e fontes públicas. Por isso esta auditoria (Fase 0) é a conferência real contra o código, e os dois documentos se complementam: o pacote traz o diagnóstico de fora (o que apareceu pro usuário final) e este arquivo traz o diagnóstico de dentro (onde e por que acontece).

### Dado real de cliente — resolvido

Orlando confirmou que a leitura foi feita só na tela do processo aberto (nada além disso). Mesmo assim, redigi o nome do cliente, número do processo e número de benefício em `02-RELATORIO-AUDITORIA.md` antes do commit, por consistência com a própria regra R9 do pacote (nada de dado real de cliente em arquivo versionado).

## 9. Próximo passo

Conforme o plano mestre, a Fase 1 (Base Legal Viva + Fact Ledger + Citation Gate + Pontos de Atenção determinísticos + reescrita dos prompts pra proibir citar lei fora da base) é o próximo passo, mas só começo depois da sua aprovação explícita desta Fase 0 — e da decisão sobre o item 8 acima.
