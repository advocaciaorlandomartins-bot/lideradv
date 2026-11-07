---
name: controle-tarefas
description: "Use SEMPRE que o usuário pedir qualquer tarefa com mais de um item, uma varredura/auditoria, uma lista de correções, ou qualquer pedido que se desdobre em vários passos. Também use sempre que chegar um pedido novo enquanto outra lista de controle já está em andamento (nesse caso, o pedido novo é ACRESCENTADO ao final da lista existente, nunca substitui ela). Gera e mantém uma lista de controle numerada e visível pro usuário, com status de cada item, pra nunca perder ou esquecer um pedido no meio do trabalho."
---

# Controle de Tarefas

Orlando pediu este padrão explicitamente em 2026-11-07, depois de notar que itens pedidos por ele ficaram sem fazer porque não havia uma lista de controle formal — o trabalho ia "por memória", e sem registro visível um pedido podia se perder no meio de outro.

## Regra

1. **No início de qualquer tarefa com múltiplos itens** (ou que você suspeite que vai se desdobrar em vários), monte uma lista numerada explícita de TODOS os itens a fazer, antes de começar a executar. Mostre essa lista pro usuário na sua resposta.
2. **Ao concluir cada item**, marque como feito (✅) e mostre a lista atualizada (ou pelo menos o item que mudou de status) antes de seguir pro próximo — não execute tudo em silêncio e só reporte no final.
3. **Nunca declare a tarefa toda concluída sem revisar item a item da lista.** Se algum item não foi feito, diga isso explicitamente — não omita.
4. **Se chegar um pedido novo enquanto uma lista anterior ainda tem item pendente**: NÃO abandone a lista nem pare o que estava em andamento. Acrescente o(s) novo(s) pedido(s) ao FINAL da lista existente, continue de onde estava, e avise que o pedido novo foi registrado na fila (ex.: "Adicionei isso como item N da lista — vou continuar o que estava fazendo e chego nele depois").
5. **A lista é a fonte de verdade da sessão para "o que falta fazer"** — ao ser perguntado sobre progresso em qualquer momento, responda mostrando a lista completa com status atual, não um resumo vago.
6. Isso vale tanto para tarefas técnicas (correções de código, deploy) quanto para pedidos administrativos/organizacionais do Orlando.

## Formato da lista

Use checkboxes markdown simples, numerados, com uma frase curta por item — sem precisar de ferramenta externa de task-tracking, só a lista mesmo, visível na resposta:

```
1. [x] Atualizar Next.js (CVE RCE)
2. [ ] Corrigir SSRF na validação de URL do Blob (12 pontos)
3. [ ] Guard de IA vazia em cerebroJuridico.ts:2705
4. [ ] (novo, adicionado em andamento) Revisar permissões da tela X
```

## Não confundir com memória

Esta lista é de controle de **tarefa em andamento na sessão atual** — não é memória persistente entre conversas. Ela não deve ser salva no sistema de memória (`memory/`); ela vive na conversa e deve sobreviver a compactações porque aparece explicitamente no texto das respostas (o resumo de compactação preserva texto que você escreveu). Memória é para o que o Orlando pede para lembrar entre sessões — isso é outra coisa, veja a skill `finalizar-tarefa`.
