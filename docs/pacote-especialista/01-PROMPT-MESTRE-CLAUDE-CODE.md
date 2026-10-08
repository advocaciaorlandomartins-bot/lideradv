# LiderAdv — Instruções mestras para o Claude Code

# Objetivo: transformar o LiderAdv no especialista previdenciário mais confiável, automatizado e auditável

> Cole este arquivo inteiro no Claude Code, na raiz do repositório do LiderAdv.
> Contexto: o LiderAdv (lideradv.vercel.app) é o sistema de gestão do escritório de Orlando Martins, foco previdenciário/INSS. Já existem: Dr. Lex (análise de documentos), Cérebro Jurídico (análise e aprendizado), Íris (assistente), Diagnóstico Estratégico, Gerar Petição, Quesitos Médicos, checklist de documentos por benefício, TramitaSign, módulos de Audiências/Perícias/DCB/Benefícios/Alvarás-RPVs.

## 0. COMO TRABALHAR (obrigatório)

1. **Antes de alterar qualquer coisa**, inspecione o repositório: stack, banco, onde ficam os prompts de Dr. Lex / Cérebro Jurídico / Diagnóstico / Petição / Quesitos, como as IAs são chamadas e como os documentos são guardados. Escreva um resumo curto em `docs/auditoria-tecnica.md` e **adapte** este plano à stack real (não assuma tecnologia).
2. Trabalhe **por fases** (seção 6). Ao fim de cada fase: rode build/lint/testes, mostre o que mudou e **pare** para aprovação do Orlando.
3. Nada de dados reais de clientes em testes, logs ou commits. Use dados sintéticos.
4. Toda mudança que afete o que o sistema afirma juridicamente deve ter teste automatizado.
5. Se algo exigir decisão do Orlando (custo, chave de API, política), pergunte; não decida sozinho.

## 1. REGRAS INVIOLÁVEIS (valem para todos os agentes e prompts)

R1. **Nada inventado.** Proibido criar lei, artigo, súmula, tema, acórdão, número de processo, ementa, valor, data, nome ou fato. Se a fonte não está no sistema, a resposta é `[LACUNA — verificar na fonte oficial]`.
R2. **Toda afirmação tem fonte verificável:** fato → documento + página + trecho; lei → texto da Base Legal Viva + versão/vigência; precedente → tribunal + número + órgão + data + trecho da tese + link; cálculo → memória de cálculo.
R3. **Vigência primeiro.** Antes de citar norma, verificar a redação aplicável **na data do fato / DER** (direito intertemporal) e se há alteração posterior. Nunca usar redação revogada como se vigente.
R4. **Citation Gate:** nenhuma minuta é exibida como "pronta" se houver citação não verificada. Ela fica `BLOQUEADA` com a lista de pendências.
R5. **Confiança explícita:** cada fato/tese recebe `confirmado | documental | alegado | ausente | conflitante`. Teses contrárias relevantes devem ser apresentadas ao advogado (não escondidas).
R6. **Humano decide.** Nada é protocolado, enviado ao cliente ou ao tribunal sem aprovação registrada do advogado. Toda peça sai com checklist pré-protocolo.
R7. **Legalidade e ética:** respeitar Estatuto da Advocacia/Código de Ética da OAB e LGPD. Nunca orientar fraude, omissão de renda, falsidade documental ou litigância temerária. Se o caso for inviável, dizer isso com fundamento.
R8. **Não prometer resultado.** Probabilidade = fatores explicados, nunca "garantido".
R9. **Dados sensíveis** (saúde, menor de idade): mínimo necessário ao enviar para modelo (mascarar CPF, endereço, telefone quando irrelevantes), sem retenção/treino pelo provedor quando houver opção, log de acesso.

## 2. ARQUITETURA ALVO

```
Documentos ─► Extrator ─► FACT LEDGER (fato, doc, página, trecho, status)
                                  │
Base Legal Viva ─► Auditor Legal ─┤
Jurisprudência Viva ─► Pesquisador┤
                                  ▼
          Classificador de Benefício ► Pontos de Atenção ► Estrategista
                                  ▼
                              Redator (só usa o que está no ledger/base)
                                  ▼
                 Juiz Revisor (adversarial) ► Auditor de Citações (Citation Gate)
                                  ▼
                       Aprovação do advogado ► Checklist ► Protocolo (manual)
Sentinela 24h (jobs): legislação, jurisprudência, movimentações, prazos, revalidação de citações, relatório diário
Curador do Cérebro: aprende com resultados → proposta de melhoria → teste de regressão → aprovação humana
```

## 3. MODELO DE DADOS (adaptar ao banco existente)

Criar (ou mapear para tabelas existentes) com migrações reversíveis:

- `fontes_legais`: id, norma (ex.: "Lei 8.742/1993"), url_oficial, texto_versionado, hash, vigencia_inicio, vigencia_fim, coletado_em, status.
- `dispositivos`: id, fonte_id, caminho (art/§/inciso), texto, redacao_dada_por, vigente_de, vigente_ate, revogado(bool).
- `precedentes`: id, tribunal, tipo (súmula/tema/acórdão), numero, orgao, data_julgamento, tese_trecho_exato, link_oficial, status (afetado/julgado/trânsito/superado), verificado_em, hash_trecho.
- `fatos_caso` (Fact Ledger): id, processo_id, fato, documento_id, pagina, trecho, status (`confirmado|documental|alegado|ausente|conflitante`), extraido_por, conferido_por.
- `citacoes_peca`: id, peca_id, tipo, referencia_id, trecho_usado, verificada(bool), verificada_em, resultado.
- `pontos_atencao`: id, processo_id, codigo, gravidade (`impeditivo|alto|medio|baixo`), descricao, base (dispositivo/precedente/fato), resolvido(bool).
- `pecas`: id, processo_id, versao, estado (`rascunho|bloqueada|revisada|aprovada`), aprovado_por, aprovado_em, checklist_json.
- `resultados_processo`: id, processo_id, desfecho, motivo_decisivo, juizo, perito, teses_usadas, aprendizados_json (anonimizado).
- `agent_runs`: id, agente, entrada_hash, saida, fontes_usadas, tokens, custo, duracao, erro, criado_em.
- `melhorias_propostas`: id, origem, descricao, diff, resultado_teste, estado (`proposta|testada|aprovada|rejeitada`), aprovado_por.
- `auditoria`: ator, acao, entidade, antes/depois, em.

## 4. AGENTES (prompts-base; mover para dados editáveis, não hardcode)

Cada agente: entrada/saída em JSON validado por schema; temperatura baixa; nunca recebe permissão de escrever fora do seu escopo; todo run grava em `agent_runs`.

**4.1 Extrator (evolução do Dr. Lex)**
"Extraia SOMENTE o que está escrito no documento. Para cada campo devolva {valor, pagina, trecho_literal, confianca}. Se ilegível ou ausente, devolva null e motivo. Não complete, não deduza, não normalize nomes: se houver grafias diferentes entre documentos, registre `conflitante` com ambas as fontes."

**4.2 Classificador de Benefício**
"Dado o Fact Ledger, indique os benefícios possíveis (espécie/NB quando aplicável), requisitos de cada um, quais requisitos estão `confirmado`, `alegado`, `ausente`. Cite o dispositivo da Base Legal Viva para cada requisito. Se dois benefícios forem possíveis, compare. Não escolha benefício sem requisito comprovado."

**4.3 Auditor Legal (vigência)**
"Para cada dispositivo que a análise pretende usar, consulte `dispositivos` na data do fato/DER. Retorne a redação aplicável, alterações posteriores e se há norma superveniente. Se o dispositivo não estiver na base: `[LACUNA]` e abra tarefa de coleta."

**4.4 Pesquisador de Jurisprudência**
"Busque precedentes nos portais oficiais cadastrados (STF, STJ, TNU, TRFs, turmas recursais). Retorne apenas precedentes encontrados, com tribunal, número, órgão, data, trecho literal da tese e link. Indique status (afetado, julgado, trânsito, superado). Inclua os contrários relevantes. Nunca complete número ou ementa de memória."

**4.5 Pontos de Atenção (regras determinísticas + IA)**
Implementar como regras de código (não só prompt) que disparam alertas. Exemplos obrigatórios para a área:

- BPC: verificar benefício já recebido pelo requerente/grupo familiar (acumulação — art. 20 §4º da Lei 8.742/93, exceções legais), composição do grupo familiar (art. 20 §1º), renda e deduções (art. 20 §3º-A e §14), CadÚnico e CPF (§12), impedimento de longo prazo (§2º e §10), avaliação biopsicossocial.
- Benefícios previdenciários: qualidade de segurado, carência, DER × data do fato, regra de transição aplicável (EC 103/2019), tempo especial (PPP/LTCAT), incapacidade (laudos, DII, DCB).
- Prazos: prescrição, decadência, prazo recursal, validade de CadÚnico (menos de 2 anos), data de perícia/avaliação.
- Dados: nome divergente entre documentos, CPF inválido, datas incoerentes, documentos vencidos/ilegíveis.
  Cada regra cita o dispositivo da Base Legal Viva; as regras ficam em tabela editável com versão.

**4.6 Estrategista (Diagnóstico Estratégico)**
"Produza: tese principal, teses subsidiárias, provas a produzir, riscos, contra-argumentos prováveis do INSS, e **probabilidade como faixa com fatores** (cada fator ligado a fato ou precedente do ledger). Proibido número sem fatores. Se faltarem dados críticos, devolva `INSUFICIENTE` e a lista do que falta."

**4.7 Redator (Gerar Petição)**
"Redija a peça usando APENAS: fatos do Fact Ledger (com status `confirmado` ou `documental`; `alegado` só como alegação), dispositivos da Base Legal Viva e precedentes verificados. Estrutura: endereçamento correto, qualificação, fatos, direito, pedidos (incluindo tutela quando cabível), provas, valor da causa com memória de cálculo. Marque `[VERIFICAR]` onde houver lacuna. Não invente cidade, vara, número, data ou valor."

**4.8 Juiz Revisor (adversarial)**
"Leia a peça como (a) juiz federal/de juizado e (b) procurador do INSS. Liste: fatos sem prova, teses sem base, pedidos incompatíveis com os fatos, contradições com documentos, citações frágeis, preliminares ignoradas, riscos de improcedência e como saná-los. Dê parecer: `APTA | APTA COM AJUSTES | NÃO APTA`. Seja duro: seu papel é achar o que o INSS e o juiz achariam."

**4.9 Auditor de Citações (Citation Gate)**
Programático, não só IA: para cada item de `citacoes_peca`, reabrir a fonte (base interna ou portal oficial), comparar o trecho literal e marcar verificada/falhou. Qualquer falha → `pecas.estado = bloqueada`. Registrar tudo.

**4.10 Sentinela 24h** — ver seção 5.

**4.11 Curador do Cérebro**
"A cada resultado registrado, extraia (anonimizado) motivo decisivo, tese que funcionou/falhou, perfil do juízo/perito. Proponha melhorias como diff (regra, prompt ou modelo de tese), nunca aplique direto. Cada proposta roda no golden set; só vai para produção com aprovação humana."

## 5. AUTOMAÇÃO 24h (jobs agendados)

Usar o agendador da plataforma de deploy (ex.: cron do Vercel ou fila equivalente; confirmar na stack). Cada job: idempotente, com timeout, retry com backoff, log em `agent_runs`, alerta em caso de falha.

| Job                    | Frequência          | O que faz                                                                                                                                                                              |
| ---------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `legislacao-sync`      | diário              | Rebaixa textos das normas cadastradas dos sites oficiais, compara hash; se mudou, cria versão, notifica e marca peças/análises afetadas para revalidação                               |
| `jurisprudencia-radar` | diário              | Consulta portais oficiais por temas monitorados (BPC, incapacidade, aposentadorias, tempo especial, pensão etc.); novo precedente/mudança de status → candidato à base com verificação |
| `citacoes-revalidacao` | semanal             | Reconfere citações de peças em rascunho/revisão                                                                                                                                        |
| `movimentacoes`        | a cada poucas horas | Consulta movimentações (DataJud, API pública do CNJ, e/ou integrações já existentes); **validar docs oficiais de autenticação, limites e cobertura antes de implementar**              |
| `prazos-sentinela`     | diário (manhã)      | Calcula prazos, alerta em D-5/D-2/D-0, escala para responsável                                                                                                                         |
| `qualidade-dados`      | diário              | Detecta processos com dados críticos faltando/divergentes e cria pendência                                                                                                             |
| `relatorio-diario`     | diário              | Resumo para o Orlando: mudanças legais, novos precedentes, peças bloqueadas, prazos, erros evitados                                                                                    |
| `cerebro-aprendizado`  | semanal             | Processa novos resultados e gera propostas de melhoria (não aplica)                                                                                                                    |

Fontes oficiais iniciais (o agente **verifica a URL antes de usar** e não usa site que não for do órgão, exceto como pista a conferir): Planalto (legislação consolidada), Diário Oficial da União, portais de jurisprudência do STF, STJ, TNU/CJF e TRFs, página de tema/repetitivos dos tribunais, DataJud/CNJ, gov.br/inss e gov.br/previdencia (atos normativos e valores). Sites de doutrina/blogs servem só como **pista**: toda informação deles deve ser confirmada na fonte oficial antes de entrar na base.

Kill switch global: flag para pausar todos os agentes. Limite de custo diário configurável.

## 6. FASES (parar ao fim de cada uma)

### Fase 0 — Auditoria técnica

Entregar `docs/auditoria-tecnica.md` e lista dos prompts atuais (Dr. Lex, Cérebro, Diagnóstico, Petição, Quesitos, Íris) com onde cada um vive.
**Aceite:** mapa completo; nenhuma alteração funcional.

### Fase 1 — Verdade verificável (P0)

1. Criar `fontes_legais`/`dispositivos` e importar, **dos textos oficiais do Planalto**, no mínimo: Lei 8.213/1991, Lei 8.742/1993 (LOAS, com histórico de redações do art. 20), Decreto 3.048/1999, Emenda Constitucional 103/2019, Lei 13.146/2015 (para o conceito de deficiência) e as leis que alteraram o art. 20 (ex.: Lei 14.176/2021, Lei 15.077/2024, Lei 13.982/2020 — conferir no texto compilado). Guardar hash e vigência.
2. Fact Ledger com página e trecho; migrar a extração atual do Dr. Lex.
3. Citation Gate bloqueante.
4. Reescrever os prompts de análise/diagnóstico/petição conforme seção 4 e regras da seção 1; **proibir citar lei fora da Base Legal Viva**.
5. Pontos de Atenção determinísticos (4.5) + bloqueio por dados críticos (nome divergente, CPF, DER, documentos obrigatórios).
6. Mostrar na tela do processo: painel "Pontos de atenção", estado da peça (rascunho/bloqueada/aprovada) e "Dados: X%" com lista do que falta.
   **Aceite:** os testes de regressão da seção 7 passam; nenhuma minuta sem citações verificadas aparece como pronta.

### Fase 2 — Jurisprudência e revisão

1. `precedentes` + Pesquisador com portais oficiais; status de tema sempre atualizado (ex.: temas afetados na TNU/STJ/STF: mostrar "afetado/aguardando" e **nunca** citar como firmado).
2. Juiz Revisor integrado ao fluxo (peça só vai a "revisada" depois do parecer).
3. Estrategista com probabilidade explicada por fatores.
4. Quesitos Médicos/periciais por benefício, baseados em requisitos legais da base.
   **Aceite:** toda citação de jurisprudência tem link oficial e trecho literal; testes verdes.

### Fase 3 — 24h

Implementar os jobs da seção 5, painel de saúde dos agentes, relatório diário, kill switch, limites de custo.
**Aceite:** jobs rodando em staging por 72h sem erro não tratado; alertas funcionando.

### Fase 4 — Aprendizado e qualidade

Curador do Cérebro com golden set e aprovação humana; painel de métricas (citações verificadas, bloqueios, êxito por tese/juízo, retrabalho); cálculos previdenciários (CNIS/tempo/RMI) com memória de cálculo auditável.
**Aceite:** nenhuma melhoria entra sem teste e aprovação; painel mostra séries históricas.

## 7. TESTES DE REGRESSÃO (golden set mínimo — dados sintéticos)

T1. **Lei desatualizada:** caso BPC-deficiência. A análise NÃO pode afirmar que o art. 20 §2º exige "deficiência grave que impeça a vida independente ou o trabalho". Deve usar a redação vigente (impedimento de longo prazo + barreiras + participação plena e efetiva; §10: mínimo 2 anos), com citação da Base Legal Viva.
T2. **Acumulação:** caso BPC com pensão por morte previdenciária ativa no CNIS do requerente → ponto de atenção `alto/impeditivo` citando art. 20 §4º, com orientação para o advogado conferir titularidade e estratégia.
T3. **Contradição:** avaliação do INSS com "impedimento de longo prazo = sim" e indeferimento por "deficiência" → Juiz Revisor/Estrategista devem destacar a tensão e buscar precedentes oficiais (Súmula 48 da TNU; status do Tema 385 da TNU **a confirmar na fonte oficial**).
T4. **Miserabilidade:** análise não trata 1/4 do SM como limite absoluto; apresenta quadro completo (§3º, §3º-A, §11, §11-A, §14) conforme texto vigente e precedentes oficiais verificados (STF Tema 27, STJ Tema 185, TNU Tema 122 — **confirmar nos portais**). Salário mínimo vem de fonte oficial versionada, não do modelo.
T5. **Nome divergente** entre cadastro e documento → bloqueio com pendência "conferir grafia".
T6. **Precedente inexistente:** injetar citação falsa na minuta → Citation Gate bloqueia.
T7. **Lacuna:** pedir artigo que não está na base → resposta `[LACUNA]`, nunca texto inventado.
T8. **Dados insuficientes:** Estrategista devolve `INSUFICIENTE` em vez de probabilidade.
T9. **Aprovação humana:** impossível marcar peça como protocolada sem `aprovado_por`.
T10. **LGPD:** log não contém CPF/endereço em claro; envio ao modelo mascara campos desnecessários.

## 8. CRITÉRIOS GERAIS DE "PRONTO"

- 100% das citações da minuta verificadas e com link/trecho.
- Nenhum agente escreve fato sem linha no Fact Ledger.
- Todo alerta tem dispositivo/precedente de base.
- Logs, auditoria e kill switch funcionando.
- Documentação em `docs/` (arquitetura, como adicionar norma, como adicionar regra de atenção, como rodar o golden set).

## 9. O QUE NÃO FAZER

- Não confiar em memória do modelo para lei, súmula, tema, valores (salário mínimo, tetos) ou prazos.
- Não usar blog/site privado como fonte final.
- Não aplicar automaticamente melhorias geradas pelo próprio agente.
- Não protocolar, enviar ou assinar nada automaticamente.
- Não gravar dados reais em testes ou prompts versionados.

Comece pela **Fase 0** e me mostre `docs/auditoria-tecnica.md` antes de qualquer alteração.

---

## ANEXOS DO PACOTE (usar como especificação detalhada)

- `agentes/juiz-revisor.md` — especificação completa do Juiz Revisor adversarial (substitui o resumo da seção 4.8)
- `agentes/auditor-citacoes.md` — Citation Gate (seção 4.9)
- `agentes/redator-peticao.md` — Redator (seção 4.7)
- `db/schema.sql` — esquema de referência (seção 3)
- `jobs/jobs-24h.md` — jobs (seção 5)
- `tests/golden-set.json` — testes de regressão (seção 7; implementar como testes automatizados)
- `skills/` — skills para o ambiente Claude do Orlando (não fazem parte do código do sistema)
