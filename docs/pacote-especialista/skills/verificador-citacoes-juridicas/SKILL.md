---
name: verificador-citacoes-juridicas
description: Conferir cada citação de lei, súmula, tema, acórdão, valor e fato de uma peça jurídica contra fonte oficial antes do protocolo.
---

# Verificador de Citações Jurídicas

Use quando houver uma peça ou análise com citações legais/jurisprudenciais a conferir (especialmente gerada por IA).

## Regras

- Só vale fonte oficial (Planalto, DOU, portais de STF, STJ, TNU/CJF, TRFs, CNJ, gov.br). Blog, doutrina e resumo de terceiros não verificam nada.
- Nunca corrigir em silêncio: apontar divergência, mostrar a fonte e propor o ajuste.
- Se a fonte oficial não abrir, dizer que não foi possível verificar; não presumir.

## Passos

1. Extrair todas as citações: dispositivos, súmulas, temas, acórdãos (número, órgão, data), valores (salário mínimo, tetos), datas e fatos atribuídos a documentos.
2. Para cada uma: localizar na fonte oficial, comparar o trecho citado ou parafraseado (`fiel | distorce | extrapola | não encontrada`).
3. Vigência: o dispositivo estava vigente na data do fato/DER? Foi alterado depois? O precedente está julgado, apenas afetado ou superado?
4. Fatos: conferir se o trecho existe no documento e na página indicados.
5. Resultado em tabela: citação, tipo, resultado, fonte (link), observação, ação sugerida. Primeiro as que bloqueiam o protocolo.
6. Veredito: `LIBERADA` só se tudo estiver verificado; caso contrário `BLOQUEADA`, com a lista de pendências.

## Saída

Tabela de verificação + veredito + próximos passos para o advogado. Incluir a data da verificação.
