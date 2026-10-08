# LiderAdv — Relatório de Auditoria e Plano "Especialista Previdenciário 24h"

Data: 07/10/2026 · Preparado para: Orlando Martins

> **Limites desta auditoria (leia primeiro).** Auditei a tela de um processo real aberto no sistema (cliente B87, dados identificadores omitidos deste arquivo versionado) e a análise automática do Cérebro Jurídico já salva nele. **Não** executei "Gerar Petição", "Diagnóstico Estratégico" nem "Quesitos Médicos" (para não gerar custo nem alterar dados do cliente) e **não** li o código do sistema. Onde digo "a validar", o item veio de fonte secundária ou não consegui abrir a fonte oficial. Nada aqui foi inventado: o que não consegui confirmar está marcado.

## 1. Resposta honesta sobre "sem brechas para perder"

Nenhum sistema, humano ou IA, garante ganhar todos os processos: o resultado depende da prova, do juiz, do perito e da jurisprudência do momento. O que o LiderAdv **pode** garantir é eliminar as **brechas evitáveis**: lei revogada citada como vigente, precedente inexistente, prazo perdido, documento faltando, tese contrária ignorada, incoerência entre fatos e pedido. É isso que o plano abaixo ataca. Esse é o caminho para a maior taxa de êxito possível, e é o que o torna defensável perante o juiz e a OAB.

## 2. O que encontrei no sistema (evidências reais)

### 2.1 Falha grave: lei desatualizada na análise automática

A análise do processo-exemplo afirma que o art. 20, §2º, da Lei 8.742/93 "exige deficiência grave que impeça a vida independente ou impossibilite o trabalho". Conferi o texto compilado no Planalto: a redação vigente define pessoa com deficiência como quem tem **impedimento de longo prazo** (física, mental, intelectual ou sensorial) que, **em interação com barreiras, pode obstruir a participação plena e efetiva na sociedade em igualdade de condições**; o §10 define longo prazo como efeitos por no mínimo 2 anos. Ou seja: a IA do sistema reproduziu (provavelmente do despacho do INSS ou de memória do modelo) um critério superado. Uma petição construída sobre isso perderia a melhor tese do caso. **Causa provável:** o modelo responde de memória, sem base legal viva e sem checagem de vigência.

### 2.2 Ponto de atenção jurídico não sinalizado: pensão por morte ativa

Pela própria análise, o CNIS mostra **pensão por morte previdenciária ativa (NB omitido, desde 21/03/2024, ~R$ 540)** e BPC indeferido. O §4º do art. 20 veda acumular BPC com outro benefício da seguridade social (exceções: assistência médica, pensão especial indenizatória, transferências de renda constitucionais etc.); a pensão por morte previdenciária não está entre as exceções, segundo as fontes que li. O sistema **não sinalizou** isso nem como risco, nem como estratégia (opção entre benefícios, conferir quem é o titular da pensão, efeito na renda per capita). **Ação:** o advogado deve conferir no CNIS quem é o titular desse benefício. Se o sistema não levanta esse tipo de alerta sozinho, o risco de pedir algo juridicamente inviável (ou de perder a melhor estratégia) é real.

### 2.3 Contradição que o sistema não explorou

A mesma análise registra que o INSS reconheceu **impedimento de longo prazo = SIM** e **prognóstico desfavorável = NÃO**, mas indeferiu por "não atende ao critério de deficiência" (dificuldade leve em atividades e participação). A TNU, na Súmula 48 (redação de 2019, conforme texto que li), diz que o conceito de deficiência "não se confunde necessariamente com incapacidade laborativa" e exige impedimento de longo prazo de pelo menos 2 anos. E o Tema 385 da TNU (afetado em 27/08/2025) discute justamente o que é impedimento de longo prazo; **não consegui confirmar o resultado do julgamento** (a validar no portal da TNU). Um "juiz revisor" automático deveria apontar essa tensão e montar a tese.

### 2.4 Miserabilidade: critério mal explicado

A análise trata o 1/4 do salário mínimo como "limite legal" rígido. Fontes secundárias que li indicam: STF Tema 27 (RE 567985) declarou inconstitucional o critério rígido da redação antiga do §3º; STJ Tema 185: renda per capita não é a única forma de provar miserabilidade; TNU Tema 122: abaixo de 1/4 há presunção relativa. Além disso, o Planalto mostra o §11 (outros elementos de prova), §11-A (possível ampliação até 1/2 SM por regulamento, com vigência condicionada), §3º-A (Lei 15.077/2024: sem deduções não previstas em lei) e §14. **Tudo a validar nos portais oficiais**, e o sistema precisa mostrar esse quadro completo em vez de uma frase. O salário mínimo de 2026 usado na análise (R$ 1.621,00) **não foi conferido por mim**: a conta de 1/4 (R$ 405,25) está aritmeticamente correta, mas o valor deve vir de fonte oficial.

### 2.5 Inconsistências de dados

- Grafia do nome do cliente divergente entre o cadastro e a análise (documento vs. cadastro). Petição com nome errado é brecha evitável.
- Linha duplicada "Naturalidade" na extração; "Dados: 70%" sem dizer o que falta.
- Status do processo "Aguardando resultado da ação judicial" e checklist de documentos "Completo" sem verificação cruzada com a análise.
- O fluxo recomenda "comece pelo passo 2 (Complementar cadastro)" mas Diagnóstico e Petição ficam liberados: não há **bloqueio** quando dados críticos faltam.

### 2.6 Pontos fortes a preservar

Fluxo guiado (Analisar → Diagnóstico → Petição → Quesitos), extração estruturada com fonte por campo (tabelas "Campo / Valor / Fonte"), checklist de documentos por benefício, Cérebro Jurídico com aprendizado a partir de resultados, linha do tempo e tarefas. Isso é base boa; falta a camada de **verdade verificável**.

## 3. Como os concorrentes tratam o problema (fontes públicas)

- **PREV-7 (Law X / ADVBOX):** segundo o artigo da própria ADVBOX, vincula cada fato ao documento de origem com o trecho exato, classifica afirmações como confirmadas, documentais ou apenas alegadas, propõe teses por tópico com os dispositivos legais, lista contradições e lacunas, e exige revisão do advogado e checklist antes de protocolar. O artigo não usa o termo "alucinação" e não prova taxa de erro.
- **Previdenciarista (gerador de petição com IA):** em beta; a página que li não detalha como evita erros.
- **Conclusão:** o diferencial vencedor não é "gerar texto", e sim **provar cada afirmação**. O LiderAdv já tem a base de extração com fonte; falta estender isso a **lei e jurisprudência**.
- Risco real do setor: uma matéria que li relata teste em que uma IA indicou processo real com ementa inventada; o autor aponta risco de litigância de má-fé para o advogado (opinião do autor, não decisão). Por isso, nenhuma citação pode sair sem verificação.

## 4. Arquitetura recomendada

**Princípio único:** _o modelo redige; quem afirma é a fonte._ Toda afirmação de fato, lei ou precedente carrega uma referência verificável. Sem referência, a frase não entra.

1. **Base Legal Viva** — cópia versionada de textos oficiais (Planalto, DOU, atos do INSS) com data de vigência e hash. Consulta por _data do fato/DER_ (direito intertemporal). Atualização diária por job; mudança de texto gera alerta.
2. **Jurisprudência Viva** — busca nos portais oficiais (STF, STJ, TNU, TRFs, turmas recursais) por tema; guarda número do processo/tema, órgão, data, trecho exato da tese e link. Status do tema (afetado, julgado, trânsito) sempre atualizado.
3. **Citation Gate (portão de citações)** — etapa obrigatória: cada citação é reaberta na fonte e comparada ao trecho. Falhou = bloqueia a minuta e marca `[VERIFICAR]`. Sem exceção, sem "provavelmente".
4. **Fact Ledger (livro de fatos)** — cada fato do caso com documento, página e trecho; classificação confirmado / documental / alegado / ausente. A petição só usa fatos do ledger.
5. **Agentes especializados** (detalhados no arquivo para o Claude Code): Triador, Extrator, Classificador de Benefício, Auditor Legal (vigência), Pesquisador de Jurisprudência, Estrategista (probabilidade com fatores, não "chute"), Redator, **Juiz Revisor adversarial** (lê a petição como magistrado e como procurador do INSS e lista pontos fracos), Auditor de Citações, Sentinela de Prazos/Movimentações, Curador do Cérebro.
6. **Trabalho 24h** — jobs agendados: varredura diária de legislação e jurisprudência nova; monitoramento de movimentações (DataJud é a API pública do CNJ; a página oficial retornou erro de acesso para mim, então detalhes de autenticação e cobertura ficam **a validar**); revalidação semanal das citações já usadas em minutas abertas; relatório diário ao Orlando.
7. **Melhoria contínua com freio** — o Cérebro aprende com resultados (procedente/improcedente, motivo, juízo, perito), mas **toda mudança de regra/prompt/tese passa por teste de regressão (golden set) e aprovação humana**. Agente que se auto-melhora sem freio é a origem de erro silencioso.
8. **Trava humana** — nenhuma peça é protocolada nem enviada ao cliente sem aprovação do advogado; checklist pré-protocolo obrigatório; registro de auditoria (quem aprovou, quais fontes, quando).
9. **LGPD** — o sistema trata dados de menor e de saúde: criptografia, acesso por perfil, log de acesso, minimização no envio ao modelo (mascarar CPF/endereço quando não necessário) e não treinar modelos com dados identificáveis.

## 5. Roadmap

**P0 (primeiras semanas — remove as brechas):** Base Legal Viva (começando por Lei 8.213/91, 8.742/93, Decreto 3.048/99, EC 103/2019 — textos do Planalto); Citation Gate; Fact Ledger com página/trecho; bloqueio por dados críticos; alertas de "pontos de atenção" (acumulação, qualidade de segurado, carência, DER, prescrição); correção do prompt de análise para nunca citar lei sem a base legal; golden set com o caso-exemplo auditado.
**P1:** Jurisprudência Viva (STF/STJ/TNU/TRFs); Juiz Revisor; Estrategista com fatores explicados; Sentinela de prazos e movimentações; relatório diário.
**P2:** Cálculos previdenciários (CNIS, tempo, RMI) com memória de cálculo auditável; Quesitos Médicos/periciais por benefício; painel de qualidade (taxa de citações verificadas, erros evitados, êxito por tese/juízo); espelhamento de peças vencedoras _do próprio escritório_ como modelos.

## 6. Métricas para saber se está funcionando

% de citações verificadas na fonte (meta 100%); nº de peças bloqueadas pelo gate e motivo; tempo da análise à minuta; taxa de êxito por benefício/tese/juízo; prazos perdidos (meta 0); retrabalho do advogado por minuta.

## 7. Próximo passo

Cole o arquivo `claude-code-lideradv-especialista.md` no Claude Code **dentro do repositório do LiderAdv**. Ele manda o Claude Code inspecionar o código antes de alterar, executar por fases com critérios de aceite e parar nos pontos que exigem decisão sua.

## Fontes consultadas

- Planalto, Lei 8.742/93 compilada: https://www.planalto.gov.br/ccivil_03/leis/l8742compilado.htm
- ADVBOX, PREV-7: https://advbox.com.br/blog/agente-prev-7/
- Previdenciarista, gerador de petição com IA: https://previdenciarista.com/inteligencia-artificial-gerador-peticao-previdenciaria/
- IEPREV, Tema 385 da TNU: https://www.ieprev.com.br/blog/tema-385-da-tnu-o-que-significa-impedimento-de-longo-prazo-no-bpcloas
- Previdenciarista, alteração da Súmula 48 da TNU: https://previdenciarista.com/blog/tnu-altera-redacao-de-sumula-sobre-beneficio-assistencial-e-fixa-novos-entendimentos/?cat=4
- Teses e Súmulas, miserabilidade (STF/STJ/TNU): https://tesesesumulas.com.br/tema/miserabilidade
- Previdenciarista, BPC e acumulação: https://previdenciarista.com/blog/o-bpc-pode-ser-acumulado-com-outros-beneficios-previdenciarios/
- Jus.com.br, advocacia segura e IA: https://jus.com.br/artigos/116957/reflexoes-sobre-a-advocacia-segura-no-tempo-da-ia
- CNJ, API pública do DataJud (resultado de busca; página não abriu para mim): https://www.cnj.jus.br/sistemas/datajud/api-publica/
