# LiderAdv — Auditoria técnica (Fase 0) + status da Fase 1

Data: 2026-10-07. Baseada em leitura direta do código em `src/`, `migrations/` e `vercel.json` — não em suposição e não no conteúdo de `docs/pacote-especialista/` (que é um **plano proposto, não implementado**; ver seção 8).

## 0. Status da Fase 1 (atualizado 2026-10-08)

| Passo                 | Status                                                                                                                                                                                                                                                                                                                                                                                                                                  | Onde                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 1. Base Legal Viva    | Feito — 4 normas, 188 dispositivos: LOAS (50 disp.: BPC completo — requisitos, renda, revisão/suspensão/cessação), Lei 8.213/91 (100 disp.: período de graça, carência, aposentadoria especial, invalidez, auxílio-doença, salário-maternidade, pensão por morte, decadência/prescrição), EC 103/2019 (30 disp.: as 4 regras de transição + pensão por morte pós-reforma), Lei 13.146/2015 (8 disp.: art. 2º, definição de deficiência) | `migrations/009`, `src/lib/base-legal-db.ts`, `scripts/seed-base-legal*.ts`           |
| 2. Fact Ledger        | Feito, sem página/trecho por campo (limitação conhecida)                                                                                                                                                                                                                                                                                                                                                                                | `migrations/010`, `src/lib/fact-ledger-db.ts`                                         |
| 3. Citation Gate      | Feito pra citação de LEI, cobrindo as 4 normas acima; jurisprudência é Fase 2. Parser reescrito depois de 9 bugs reais achados testando (ver lista na seção 0.1)                                                                                                                                                                                                                                                                        | `src/lib/citation-gate.ts`, rodando automático em Gerar Petição                       |
| 4. Reescrever prompts | Feito: Gerar Petição + Cérebro recebem a Base Legal Viva pro benefício certo (mapa completo em `base-legal-db.ts: NORMAS_POR_BENEFICIO`, conferido contra os códigos reais do formulário de cliente); fechada a brecha de "jurisprudência pacífica do TRF5" genérica                                                                                                                                                                    | `ai-juridico-skills.ts`, `ia/peticao/route.ts`, `cerebroJuridico.ts: prepararAnalise` |
| 5. Pontos de Atenção  | BPC (só B87/B88, NÃO B80): acumulação, impedimento de prazo, miserabilidade, CPF, cessação possivelmente indevida. Genérica (qualquer benefício): prescrição quinquenal da DER, nome divergente (CPF em comum entre cadastro e membros_familia)                                                                                                                                                                                         | `src/lib/pontos-atencao-db.ts`                                                        |
| 6. Painel na tela     | Feito (pontos de atenção); "estado da peça" (rascunho/bloqueada/aprovada) não existe ainda                                                                                                                                                                                                                                                                                                                                              | `pontos-atencao-panel.tsx`                                                            |

Testado contra `docs/pacote-especialista/tests/golden-set.json` em `scripts/golden-set-test.ts`: 5 dos 14 casos originais têm implementação real testável hoje (T1, T2, T5, T6-equivalente, T7) — todos passando, mais 8 testes de regressão próprios — 13 PASS, 0 FAIL no total. Os outros 9 casos do golden-set original dependem de peças da Fase 2 (Juiz Revisor, Jurisprudência Viva, Auditor Legal por data) ou de partes da Fase 1 ainda não feitas (estado da peça, kill switch, mascaramento LGPD).

**Nome divergente (T5) testado contra dado real:** rodei a regra nova contra os 23 processos já cadastrados e ela achou 1 caso real de divergência de grafia entre o cadastro e um documento analisado (mesmo CPF) — vale o Orlando conferir esse caso específico quando revisar.

**Decisão já tomada com o Orlando:** Citation Gate roda automático e silencioso, só avisa quando acha problema — não bloqueia nada ainda (bloquear hoje ainda pegaria qualquer petição de um benefício fora do mapa de normas cobertas).

**Bug real corrigido em produção (2026-10-08):** B80 (Salário-Maternidade) estava sendo tratado como código de BPC em `pontos-atencao-db.ts` e `base-legal-db.ts` (erro meu, não verificado contra os códigos reais do formulário quando escrevi o motor de regras). 2 processos reais de clientes mostraram um alerta de "faltam dados de miserabilidade" que não tem nada a ver com salário-maternidade. Dados corrigidos em produção, código corrigido, teste de regressão adicionado. Lição: sempre conferir código de benefício contra `new-client-form.tsx`/`edit-client-form.tsx` antes de usar num mapa — é a fonte de verdade real, não suposição.

**Achado grave em código PRÉ-EXISTENTE (2026-10-08, não é meu nem do pacote):** `cerebroJuridico.ts: calcularAlertas()` — os alertas jurídicos determinísticos que o Cérebro injeta direto no prompt de diagnóstico — tinha 4 citações erradas em 6 checadas contra o Planalto (art. 103 §1º inexistente, art. 62 em vez de 101, art. 24 em vez de 49 da Lei 9.784, art. 304 do Decreto 3.048 em vez do art. 60 §11 da Lei 8.213) e um bug de lógica mais sério: o alerta de "prazo de recurso CRPS" contava os 30 dias a partir da DER (data do requerimento) em vez da data da decisão, e só olhava o campo `resultado_admin`, ignorando `resultado_administrativo` (o que o fluxo manual de Produção realmente usa). Confirmado em dado real: **nenhum dos 8 processos previdenciários com indeferimento registrado geraria esse alerta antes da correção.** Todas as citações corrigidas, lógica de data corrigida, `art. 101` adicionado na Base Legal Viva. Ver commit `53a6473` pro detalhe de cada correção.

**Achei mais um erro (6º no total) na mesma varredura:** o `BASE_LEGAL` — o bloco de texto estático que vai em TODO diagnóstico do Cérebro, não só nos alertas — citava "Art. 161" pra recuperação de qualidade de segurado; esse artigo (tanto na Lei 8.213 quanto no Decreto 3.048) é sobre serviço social, sem relação nenhuma. Corrigido (commit `7194217`), citando o art. 27-A que já está verificado.

**⚠️ Pendência priorizada, não auditada ainda:** só conferi uma amostra pequena do `BASE_LEGAL` (que tem ~280 linhas, dezenas de citações de lei, jurisprudência — súmulas, temas, acórdãos — e até uma IN do INSS) e do bloco "JURISPRUDÊNCIA DOMINANTE" em `ai-juridico-skills.ts`. Taxa de erro encontrada até agora na amostra pequena: alta o suficiente (6 erros reais achados sem procurar muito) pra eu recomendar que o Orlando trate isso como prioridade pra uma auditoria completa — mas é trabalho de verificar DEZENAS de citações de lei e jurisprudência contra fonte oficial, uma por uma, não é algo pra apressar numa sessão só. Fica registrado aqui como o próximo item grande, não escondido.

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

## 10. Fase 3 — automação 24h (2026-10-08, sessão final)

Conforme instrução de terminar todas as fases que der, sem parar pra validação intermediária. Resumo do que foi feito — detalhe completo no relatório final que vou te mandar:

- **Kill switch** (interruptor de emergência): tabela `config_agentes`, novo toggle em Configurações → Agentes de IA, pausa as 3 rotas que chamam a Anthropic a pedido do usuário (petição, Cérebro, análise de documento) + o resumo diário de DOU/INSS. Não pausa os crons determinísticos (publicações, prazos, limpeza) — eles não usam IA, não tem porquê parar.
- **Rastreamento de uso/custo de IA**: tabela `ia_uso`, grava tokens reais de cada chamada; alerta opcional no resumo diário (só liga se você configurar o preço do token e um limite nas envs — não virou ruído por padrão).
- **"Painel de saúde dos agentes" e "relatório diário"** (outros dois itens da Fase 3 do plano): já existiam de sessão anterior a esta — `src/lib/saude-sistema.ts` (consumido pela Íris via tool `verificar_saude`) e `src/lib/resumo-diario.ts` (WhatsApp às 8h). Não precisei construir do zero, só emendei o custo de IA no segundo.
- **Legislação-sync / jurisprudência-radar** (scraping novo pra manter a Base Legal Viva e jurisprudência atualizadas sozinhas): **não implementado**. `cron/atualizacoes-legais` já cobre notícia regulatória (portaria/IN), mas não o texto de lei nem acórdão — construir isso de verdade é escopo de scraper + parser por fonte (Planalto, STF, STJ, TNU), trabalho grande, melhor como projeto à parte.

## 11. Auditoria da jurisprudência em `ai-juridico-skills.ts` (2026-10-08)

Pendência que a seção 0 já tinha marcado como "priorizada, não auditada". Resultado — ver `git log` do commit de correção pro texto exato:

- **Achado grave**: a tese "Revisão da Vida Toda" estava descrita no prompt como favorável/consolidada no STF — o STF na verdade **julgou contra** em 21/03/2024 (Tema 1102) e fechou em definitivo em 26/11/2025. Corrigido o texto e o nome do tipo de petição selecionável.
- Mais 2 citações erradas corrigidas (ADI 4.232 → RCL 4.374/PE; um número de acórdão do TRF5 com cara de placeholder, trocado por descrição sem número).
- Confirmados corretos: Súmula 568 STJ, RE 626.489/SE, Súmula 198 TFR, RE 567.985, Tema 416 STJ.
- **Não verificado nesta rodada**: os enunciados específicos da TNU (6, 33, 47, 48, 57, 72, 83) e o Tema 962/REsp 1.682.714 STJ — não achei fonte que confirmasse ou contradissesse o conteúdo exato citado. Mesma recomendação da seção 0: útil fazer uma varredura dedicada, um item de cada vez, contra fonte oficial.

## 12. Itens do plano que ficaram de fora desta sessão (de propósito)

- **T9 (aprovação humana antes de "protocolar" uma peça gerada por IA)**: o modelo de dados do plano mestre pressupõe um estado rascunho→aprovada→protocolada numa única peça. Não existe assim no LiderAdv: `ia_peticoes` já tem um campo `aprovada` (gate de admin pra virar referência no banco de petições), e "protocolado" é um conceito completamente separado, vivendo no fluxo de Produção/Controles (prazo de audiência, controle). Construir uma trava nova ligando os dois seria inventar fluxo que você não usa hoje — fica como pergunta de produto pra você, não decisão minha.
- **T10 (mascaramento LGPD antes de mandar dado pro modelo)**: não dá pra aplicar um mascaramento genérico sem risco real de quebrar a própria utilidade do Dr. Lex/Cérebro — CPF, CID, renda e data de nascimento são exatamente os dados que a IA precisa pra calcular carência, miserabilidade, DER etc. Mascarar "errado" aqui é pior que não mascarar: o sistema erraria silenciosamente. Isso pede uma decisão sua de produto (o que é seguro mascarar sem quebrar a análise), não um palpite meu.
- **T12 (vigência por data exata do fato/DER) — atualizado, agora PARCIAL**: reavaliei depois do relatório inicial. Pra normas com uma única promulgação (sem emenda ao próprio texto depois), dá pra confirmar a data com segurança — foi o caso da EC 103/2019 (13/11/2019, confirmado, nenhum dos 30 dispositivos cadastrados cai na exceção dos arts. 11/28/32 que têm vigência diferente). `vigente_de` populado pra essa norma + nova regra de Pontos de Atenção (`avaliarTransicaoEC103`) alertando direito adquirido quando a DER de uma aposentadoria (B41/B42/B46) é anterior à reforma. Testado (golden-set `transicao-ec103`, PASS). Pra Lei 13.146/2015 tentei o mesmo e desisti: achei 3 datas de vigência diferentes citadas por fontes distintas (02/01, 03/01, 06/01/2016) — não arrisquei. Generalizar isso pra LOAS/Lei 8.213/Lei 13.146 (as normas com dezenas de emendas) continua de fora pelo motivo original: exigiria datar ~35 leis alteradoras uma por uma.
- **Fase 2 inteira (Jurisprudência Viva, Juiz Revisor, Estrategista com fator de incerteza explícito)** e **Fase 4 inteira (Curador do Cérebro, cálculo previdenciário com memória, espelhamento de peças vencedoras)**: infraestrutura nova e grande, não dá pra fazer de forma honesta "de leve" numa sessão só sem virar meia-implementação. Fase 4 em particular também depende de volume de casos reais encerrados no sistema (que hoje é baixo) pra ter dado suficiente pra aprender algo.

Lembrete de arquitetura que vale manter daqui pra frente: **não existe e não deve existir um segundo agente de IA** no sistema — qualquer coisa parecida com "Juiz Revisor" deveria ser uma tool nova pra Íris chamar (como as ~25 que ela já tem), não um agente separado.

## 13. Auditoria de `BASE_LEGAL` em `cerebroJuridico.ts` (2026-10-08, continuação)

Esta é a pendência maior ainda não fechada — o bloco que vai em **todo** diagnóstico do Cérebro (não só petição), ~260 linhas, dezenas de citações. Resultado desta rodada:

- **Achado grave, maior impacto financeiro de toda a auditoria**: "Teto INSS 2026: R$ 8.157,41" era na verdade o teto de **2025** rotulado como 2026 — o valor real (Portaria Interministerial MPS/MF nº 13/2026) é **R$ 8.475,55** (diferença de R$ 318,14). Existia em DOIS lugares: o texto fixo do prompt e o bloco "DADOS FINANCEIROS VIGENTES" injetado em toda análise de processo (este segundo sem nenhum campo configurável de override, ao contrário do salário mínimo que tem `processo.sm_escritorio`). Corrigido nos dois. Salário mínimo 2026 (R$ 1.621,00) conferido e está correto.
- Confirmados corretos nesta rodada: ADIs 2.110/2.111 STF (carência salário-maternidade), STJ Tema 862 (DIB auxílio-acidente), e — numa auditoria rápida das outras áreas (trabalhista/consumidor em `ai-juridico-skills.ts`) — Súmulas 428 e 244 TST, ADI 6050 STF, Súmulas 297/381/566/385 STJ. Essas áreas fora do previdenciário parecem ter taxa de erro bem menor na amostra verificada.
- **Não verificado, fica como pendência**: os ~20 enunciados/temas da TNU citados (Súmulas 9/10/28/33/44/47/54/57/63/72/77, Temas 11/173/185/192/220/285/300/301/315/327/348) e alguns itens STF/STJ específicos (Tema 995, RE 636.941, ARE 930.647, Tema 27, Tema 312, Tema 352 STJ, Súmula 548 STJ) — busca na web não deu confirmação confiável pra número+conteúdo exato de cada um (resultados genéricos, sem o verbete completo). Diferente da Base Legal Viva (texto de lei, onde dá pra ler o Planalto direto), confirmar um enunciado específico de corte superior exige acesso à base oficial do CJF/STJ/STF ou um profissional com acesso a sistema de pesquisa jurisprudencial (ex: Jusbrasil Pro, Westlaw, ou o próprio site do tribunal) — recomendo esse canal pra fechar o que falta, em vez de eu continuar tentando por busca genérica (risco de taxa de confirmação falsa-positiva).

## 14. T8 sai de SKIP (2026-10-08, continuação)

A lógica de "probabilidade insuficiente" (2+ dados críticos faltando → força prob=null) vivia inline dentro de `cerebroJuridico.ts:salvarAnalise`, um arquivo `"server-only"` — por isso só dava pra confirmar por revisão manual, nunca por teste rodando de verdade. Extraí a lógica pura (sem IA, sem DB) pra `src/lib/cerebro-probabilidade.ts` (sem `server-only`), que `cerebroJuridico.ts` agora chama — comportamento idêntico, só que testável. Golden-set: **16 PASS, 0 FAIL, 7 SKIP** (era 15/0/8).

Mesmo princípio vale pros SKIPs que sobraram (T3/T4/T9/T10/T11/T12-parcial/T13): só ficam como SKIP enquanto a funcionalidade de fato não existe ou depende de uma decisão externa (sua, ou pesquisa jurídica dedicada) — não por preguiça de testar o que já existe.

## 15. Mais uma rodada de auditoria de `BASE_LEGAL` (2026-10-08, continuação)

- **Achado**: STJ "Súmula 548" (correção de benefícios anteriores a 1988) não existe com esse conteúdo — o verbete real é a **Súmula 456**. Corrigido, com o texto completo do verbete.
- **Confirmados corretos**: Enunciado 19 CRPS (Resolução 13/2025), Ofício-Circular DIRBEN/INSS nº 63/2025 (segurada especial), STF Tema 27 (RE 567.985/580.963), STF Tema 312, STF ARE 930.647 AgR.
- **Lição prática**: o Ofício-Circular 63/2025 pareceu fabricado numa primeira busca genérica (não apareceu) e só foi confirmado numa segunda busca com termos mais específicos — citações administrativas recentes (2025) são mal indexadas na web pública, então "a primeira busca não achou" não é prova de fabricação, só motivo pra tentar de novo antes de concluir.
- **Não confirmado nem contradito**: STJ Tema 352 (carência). Mesma recomendação de sempre: base oficial dedicada, não busca genérica.

## 16. Mais dois achados — um deles o mais grave de toda a auditoria de `BASE_LEGAL` (2026-10-08)

- **GRAVE**: "Lei 15.156/2025: pensão por morte para genitores de vítimas da síndrome congênita do Zika vírus (B21)" estava errado em três pontos simultâneos — não é pensão por morte (não há óbito nessa hipótese), não é código B21, e não é paga aos pais. A lei real concede indenização por dano moral (R$ 50.000, parcela única) + pensão especial mensal e vitalícia (valor do maior salário de benefício do RGPS) diretamente à PRÓPRIA pessoa com deficiência decorrente do Zika, via laudo de junta médica — não é um benefício do catálogo usual do INSS. Se usado pra orientar uma família antes da correção, teria indicado requerente errado, fundamento errado e código de benefício errado. Corrigido.
- Menor: "Portaria MTP 87/2023" tinha o número certo mas o órgão errado — é Portaria Conjunta DIRBEN/PFE/INSS (ato interno do INSS), não do Ministério do Trabalho e Previdência. Corrigido nos 2 lugares, com o escopo real confirmado (B32 com DIB desde 14/11/2019 precedido de B31 com DII até 13/11/2019).
- Confirmados corretos: Lei 14.126/2021 (visão monocular), Decreto 6.214/2007 (conceito geral confirmado, número exato do parágrafo não pude confirmar com 100% de certeza), Resoluções CNJ 354/2020, 481/2022 e 508/2023 (conceito de Pontos de Inclusão Digital confirmado; o detalhe específico "distância ≥40km" não foi confirmado nem contradito).

**Resumo acumulado desta auditoria de jurisprudência/normas administrativas (sessões de 2026-10-08)**: 8 erros reais encontrados e corrigidos — Revisão da Vida Toda (grave), ADI 4.232→RCL 4.374/PE, acórdão TRF5 fabricado, teto INSS 2026 (grave, financeiro), Súmula 548→456 STJ, Lei 15.156/2025 (grave, orientaria família errada), Portaria MTP→DIRBEN/PFE/INSS. Taxa de erro real e recorrente o suficiente pra eu reforçar a recomendação: antes de usar `BASE_LEGAL`/jurisprudência pra orientar um caso real, vale uma auditoria completa e sistemática (não por amostragem) contra fonte oficial — idealmente com acesso a uma base de pesquisa jurisprudencial dedicada, não busca genérica.
