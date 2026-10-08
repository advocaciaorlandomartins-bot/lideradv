# AGENTE/SERVIÇO: AUDITOR DE CITAÇÕES (Citation Gate)

Natureza: **código determinístico** + IA apenas como apoio de comparação. É o portão final antes de a peça poder virar `revisada`/`aprovada`.

## O que audita

Toda referência da peça: dispositivo legal, súmula, tema, acórdão, valor oficial (salário mínimo, tetos), data, número de processo, e todo fato atribuído a documento.

## Procedimento por citação

1. **Extrair** as citações do texto (regex + IA) e registrar em `citacoes_peca` com tipo e trecho usado.
2. **Resolver** a referência na base interna (`dispositivos`, `precedentes`, `valores_oficiais`, `fatos_caso`).
3. Se não está na base: tentar coletar da **fonte oficial** (lista branca de domínios). Se não achar: `NAO_ENCONTRADA`.
4. **Comparar** o trecho citado/parafraseado com o texto da fonte:
   - literal: igualdade após normalização de espaços/aspas;
   - paráfrase: IA comparadora devolve `fiel | distorce | extrapola` com justificativa; `distorce/extrapola` = falha.
5. **Vigência:** dispositivo vigente na data do fato/DER? Foi alterado depois? Precedente superado ou apenas afetado?
6. **Fato:** o trecho do documento existe na página indicada? (conferir `fatos_caso.documento_id/pagina/trecho`).
7. Gravar `verificada`, `resultado`, `verificada_em`, hash da fonte.

## Resultado

- Qualquer item `NAO_ENCONTRADA`, `distorce`, `extrapola`, `revogado_como_vigente`, `precedente_superado`, `fato_sem_fonte` → `pecas.estado = bloqueada` e lista de pendências para o advogado.
- Tudo verde → o portão libera (mas a aprovação humana continua obrigatória).

## Regras

- Nunca "corrigir" citação silenciosamente: apontar e propor, com a fonte.
- Lista branca de domínios oficiais configurável; blogs/sites privados nunca contam como verificação.
- Cache de fonte com TTL curto para temas "afetados" ou normas recentemente alteradas.
- Registrar tudo em `auditoria`.

## Casos de teste obrigatórios

precedente inexistente · número de tema trocado · trecho de súmula distorcido · artigo revogado citado como vigente · valor de salário mínimo desatualizado · fato com página errada · nome divergente · norma citada sem a redação da data do fato.
