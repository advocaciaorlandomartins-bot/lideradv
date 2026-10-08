# Jobs 24h do LiderAdv (especificação)

Implementar com o agendador da stack (ex.: Vercel Cron + rotas protegidas por segredo, ou fila equivalente). Confirmar na Fase 0.

Requisitos de TODO job: idempotente; timeout; retry com backoff; lock para não rodar em duplicidade; checar `config_agentes.agentes_ativos` e limite de custo antes; gravar em `agent_runs`; alertar o Orlando em falha repetida; nunca escrever em peça `aprovada`/`protocolada` (apenas sinalizar).

Exemplo (adaptar):

```json
{
  "crons": [
    { "path": "/api/jobs/legislacao-sync", "schedule": "0 6 * * *" },
    { "path": "/api/jobs/jurisprudencia-radar", "schedule": "30 6 * * *" },
    { "path": "/api/jobs/prazos-sentinela", "schedule": "0 11 * * *" },
    { "path": "/api/jobs/qualidade-dados", "schedule": "30 11 * * *" },
    { "path": "/api/jobs/movimentacoes", "schedule": "0 */4 * * *" },
    { "path": "/api/jobs/citacoes-revalidacao", "schedule": "0 7 * * 1" },
    { "path": "/api/jobs/cerebro-aprendizado", "schedule": "0 8 * * 0" },
    { "path": "/api/jobs/relatorio-diario", "schedule": "30 10 * * *" }
  ]
}
```

(Horários em UTC; 11:00 UTC = 08:00 em Brasília.)

## legislacao-sync

Baixa o texto das normas cadastradas **de fontes oficiais**; compara hash; se mudou: nova versão em `fontes_legais`/`dispositivos` (vigência), cria alerta, marca análises/peças que usam o dispositivo como `revalidar`, e roda Citation Gate nelas.

## jurisprudencia-radar

Para cada tema monitorado (BPC/LOAS, incapacidade, aposentadorias, tempo especial, pensão, revisões, prescrição/decadência, acumulação etc.): consulta portais oficiais, detecta precedente novo ou mudança de status (afetado→julgado→trânsito, superação). Entra na base **só após verificação** (trecho literal + link). Gera sugestão de "tese nova/alterada" para o advogado, não aplica automaticamente.

## movimentacoes

Consulta movimentações dos processos ativos (API pública do DataJud/CNJ e/ou integrações já existentes). **Antes de implementar: ler a documentação oficial atual (autenticação, limites, cobertura, sigilo) e registrar em docs/.** Movimentação relevante → tarefa/alerta com prazo calculado.

## prazos-sentinela

Recalcula prazos; alerta D-5, D-2, D-0; escala para responsável e, sem confirmação, para o Orlando. Inclui prazo de perícia/avaliação social, validade de CadÚnico (conforme checklist atual), recursos, cumprimento de decisão.

## qualidade-dados

Procura nomes/CPF/datas divergentes, documentos faltando/vencidos/ilegíveis, processos sem DER, cliente sem representante quando incapaz, "Dados: X%" baixo. Cria pendência com dono.

## citacoes-revalidacao

Reexecuta o Citation Gate nas peças em `rascunho`/`revisada`; qualquer falha → `bloqueada` + aviso.

## cerebro-aprendizado

Processa `resultados_processo` novos (anonimizados) e gera `melhorias_propostas` (diff de regra/prompt/modelo). Roda golden set; só marca `testada`. Aprovação humana obrigatória para aplicar.

## relatorio-diario

Resumo para o Orlando: mudanças legais, precedentes novos/alterados, peças bloqueadas e motivo, prazos da semana, falhas de jobs, custo do dia, erros evitados (citações barradas, pontos de atenção levantados).

## Segurança

Rotas de job exigem segredo; sem acesso público. Allowlist de domínios oficiais; timeouts de rede; sanitização de conteúdo baixado (tratar como dado, nunca como instrução). Conteúdo de páginas externas **nunca** altera prompts ou regras: só alimenta a base após verificação.
