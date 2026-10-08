-- LiderAdv — esquema de referência (PostgreSQL). ADAPTAR ao banco/ORM existente depois da auditoria técnica (Fase 0).
-- Todas as tabelas devem respeitar o controle de acesso por escritório/perfil já existente (RLS ou equivalente).

create table fontes_legais (
  id uuid primary key default gen_random_uuid(),
  norma text not null,                -- ex.: 'Lei 8.742/1993'
  url_oficial text not null,
  coletado_em timestamptz not null default now(),
  hash_texto text not null,
  texto_versionado text not null,
  status text not null default 'ativa'
);

create table dispositivos (
  id uuid primary key default gen_random_uuid(),
  fonte_id uuid references fontes_legais(id),
  caminho text not null,              -- 'art. 20, §2º'
  texto text not null,
  redacao_dada_por text,
  vigente_de date,
  vigente_ate date,
  revogado boolean not null default false,
  unique (fonte_id, caminho, vigente_de)
);

create table precedentes (
  id uuid primary key default gen_random_uuid(),
  tribunal text not null,
  tipo text not null,                 -- sumula | tema | acordao | pedilef | outro
  numero text not null,
  orgao text,
  data_julgamento date,
  tese_trecho_exato text not null,
  link_oficial text not null,
  status text not null,               -- afetado | julgado | transito | superado
  verificado_em timestamptz,
  hash_trecho text,
  unique (tribunal, tipo, numero)
);

create table valores_oficiais (       -- salario minimo, tetos, etc.
  id uuid primary key default gen_random_uuid(),
  tipo text not null, valor numeric(14,2) not null,
  vigente_de date not null, vigente_ate date,
  fonte_url text not null, verificado_em timestamptz not null default now()
);

create table fatos_caso (             -- Fact Ledger
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null,
  fato text not null,
  documento_id uuid, pagina int, trecho text,
  status text not null check (status in ('confirmado','documental','alegado','ausente','conflitante')),
  extraido_por text, conferido_por uuid,
  criado_em timestamptz default now()
);

create table pontos_atencao (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null,
  codigo text not null,
  gravidade text not null check (gravidade in ('impeditivo','alto','medio','baixo')),
  descricao text not null,
  base_tipo text, base_ref uuid,
  resolvido boolean default false, resolvido_por uuid, resolvido_em timestamptz
);

create table pecas (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null,
  versao int not null default 1,
  texto text,
  estado text not null default 'rascunho' check (estado in ('rascunho','bloqueada','revisada','aprovada','protocolada')),
  parecer_revisor jsonb,
  checklist_json jsonb,
  aprovado_por uuid, aprovado_em timestamptz,
  constraint protocolada_exige_aprovacao check (estado <> 'protocolada' or aprovado_por is not null)
);

create table citacoes_peca (
  id uuid primary key default gen_random_uuid(),
  peca_id uuid references pecas(id) on delete cascade,
  tipo text not null, referencia_id uuid, trecho_usado text,
  verificada boolean default false, resultado text, verificada_em timestamptz, hash_fonte text
);

create table resultados_processo (
  id uuid primary key default gen_random_uuid(),
  processo_id uuid not null, desfecho text, motivo_decisivo text,
  juizo text, perito text, teses_usadas jsonb, aprendizados_json jsonb, registrado_em timestamptz default now()
);

create table agent_runs (
  id uuid primary key default gen_random_uuid(),
  agente text not null, entrada_hash text, saida jsonb, fontes_usadas jsonb,
  tokens_in int, tokens_out int, custo numeric(10,4), duracao_ms int, erro text, criado_em timestamptz default now()
);

create table melhorias_propostas (
  id uuid primary key default gen_random_uuid(),
  origem text, descricao text, diff text, resultado_teste jsonb,
  estado text default 'proposta' check (estado in ('proposta','testada','aprovada','rejeitada')),
  aprovado_por uuid, aprovado_em timestamptz
);

create table auditoria (
  id bigserial primary key,
  ator text, acao text, entidade text, entidade_id uuid, antes jsonb, depois jsonb, em timestamptz default now()
);

create table config_agentes (         -- kill switch e limites
  chave text primary key, valor jsonb not null, atualizado_em timestamptz default now()
);
-- chaves sugeridas: agentes_ativos (bool), limite_custo_diario, dominios_oficiais (lista branca)
