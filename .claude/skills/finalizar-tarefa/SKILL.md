---
name: finalizar-tarefa
description: "Use ao finalizar QUALQUER tarefa de desenvolvimento no LiderAdv (next-app) depois que o código estiver implementado — antes de dizer pro usuário que terminou. Garante a sequência fixa: verificação (tsc/eslint/build/golden-set), salvar memória relevante (se houver algo durável e não-óbvio), git commit, git push, e confirmação de deploy na Vercel — sempre nessa ordem, sempre as quatro etapas, nunca reportar 'concluído' sem ter passado por elas."
---

# Finalizar Tarefa (LiderAdv)

Orlando pediu este padrão explicitamente em 2026-11-07: ao final de qualquer tarefa, sempre salvar memória, commit, push e deploy — sem pular etapa, sem declarar concluído antes de confirmar o deploy.

## Sequência obrigatória (nessa ordem)

### 1. Verificação (antes de comitar)

```
npx tsc --noEmit
npx eslint <arquivos-tocados>
npm run build
npx tsx scripts/golden-set-test.ts
```

Não prosseguir pro commit se algum desses falhar (exceto warnings pré-existentes não relacionados à mudança atual).

### 2. Memória (só se houver algo que vale lembrar entre sessões)

Antes de comitar, pare e pergunte: "isso ensinou algo durável, não-óbvio, que uma sessão futura precisaria saber?" — um bug corrigido com causa-raiz não-óbvia, uma decisão de arquitetura, uma preferência do Orlando confirmada ou corrigida. Se sim, salve em `memory/` (arquivo + entrada no `MEMORY.md`) ANTES do commit, seguindo os tipos (user/feedback/project/reference) já estabelecidos no sistema de memória.
Se a tarefa foi puramente mecânica (ex.: só uma correção de typo, só subir uma dependência sem causa-raiz nova) — está tudo bem pular esta etapa, não forçar memória sem conteúdo.

### 3. Commit + push

```
git add <arquivos específicos — nunca -A>
git commit -m "<mensagem em português, descrevendo o porquê>

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
git push
```

Commits separados por mudança logicamente distinta (não amontoar correções não relacionadas em um commit só).

### 4. Deploy — confirmar antes de reportar

Disparar o check em background e **esperar a confirmação** antes de dizer "concluído" pro usuário:

```
sleep 90 && npx vercel ls lideradv --yes
```

Só reportar sucesso depois de ver `● Ready` no ambiente `Production` pro deploy mais recente. Se não ficar `Ready`, investigar antes de reportar qualquer coisa como concluído.

## Regra de ouro

Nunca diga "feito"/"concluído"/"no ar" sem ter passado pelas 4 etapas acima nesta tarefa. Se alguma etapa foi pulada por decisão explícita do Orlando (ex.: "não precisa commitar agora"), diga isso explicitamente em vez de simplesmente omitir a etapa.
