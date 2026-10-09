# Changelog jurídico — pra atualizar o prompt do PrevBot

Lista de tudo que mudou no conhecimento jurídico do LiderAdv nesta sessão
(2026-10-08), pra quem for atualizar o prompt/base de conhecimento do
PrevBot (repositório separado, não acessado nesta sessão). O PrevBot não
foi tocado — isto é só o material de referência pra fazer isso manualmente.

## Conteúdo NOVO adicionado

- **Lei 12.764/2012 (Lei Berenice Piva)**: pessoa com transtorno do
  espectro autista (TEA) é considerada pessoa com deficiência "para todos
  os efeitos legais" (art. 1º, § 2º) — não precisa de perícia discutindo
  SE é deficiência, só o grau/impedimento de longo prazo. Relevante pra
  BPC/LOAS por deficiência (B87).
- **CIPTEA** (Carteira de Identificação da Pessoa com TEA): documento que
  reforça prova em caso de autismo, não é exigência legal.

## Correções — informação que estava ERRADA e pode já ter sido repassada a clientes

- **"Revisão da Vida Toda"**: o STF **julgou CONTRA** essa tese em
  21/03/2024 (Tema 1102) e fechou em definitivo em 26/11/2025. Se o
  PrevBot ainda orienta cliente a pedir isso como tese válida, está
  desatualizado — só cabe hoje pra discutir modulação de efeitos em
  processo já em curso até 05/04/2024.
- **Teto do INSS 2026**: valor correto é **R$ 8.475,55** (não R$
  8.157,41, que era o teto de 2025).
- **Salário-maternidade — carência**: desde 21/03/2024 (ADIs 2.110 e
  2.111, STF) **não existe mais exigência de carência** pra
  salário-maternidade, pra nenhuma categoria (inclusive contribuinte
  individual/facultativa, que antes precisava de 10 contribuições). O
  único requisito é ter qualidade de segurada na data do parto/adoção.
  Vale pra requerimentos a partir de 05/04/2024, e retroativo dentro da
  prescrição quinquenal.
- **B87 e B88 estavam invertidos** em alguns lugares: **B87 = BPC pessoa
  COM DEFICIÊNCIA**, **B88 = BPC pessoa IDOSA**. Se o PrevBot usa esses
  códigos, confirme que está na ordem certa.
- **Lei 15.156/2025 (Zika)**: NÃO é pensão por morte pros pais. É
  indenização por dano moral (R$ 50.000, parcela única) + pensão especial
  mensal e vitalícia, pagas **diretamente à própria pessoa** com
  deficiência decorrente da síndrome do Zika — não aos genitores, e não é
  um benefício do catálogo usual do INSS (não tem código B).

## Jurisprudência corrigida (números errados)

- BPC renda per capita não é critério absoluto: citar **Tema 27 STF**
  (RE 567.985/580.963) — não "Tema 995" (que é sobre imprensa) nem "ADPF
  182" (número não confirmado, retirado).
- BPC dispensa de nova perícia de miserabilidade quando INSS já
  reconheceu: citar **Tema 187 TNU** — não "Tema 185".
- Correção de benefícios anteriores a 1988: **Súmula 456 STJ** — não
  "Súmula 548".

## Jurisprudência marcada como incerta (não usar número específico até confirmar)

Súmula 54, 63 e 77 da TNU, e RE 636.941 STF — o conceito jurídico geral
atrás de cada um é real, mas o número exato não foi confirmado contra
fonte oficial nesta sessão. Se o PrevBot cita esses números
especificamente, considere usar linguagem sem apontar o número até
confirmar.

## Onde ver o detalhe técnico completo

`docs/auditoria-tecnica.md` neste mesmo repositório — tem a lista
completa com o porquê de cada correção, incluindo commits do git pra
quem quiser ver o antes/depois exato.
