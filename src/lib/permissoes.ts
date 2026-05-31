import type { SessionUser } from "./session";

export const MODULOS = [
  { key: "crm", label: "CRM", parent: null },
  { key: "producao", label: "Produção", parent: null },
  {
    key: "producao_resultado_adm",
    label: "Resultado Administrativo",
    parent: "producao",
  },
  {
    key: "producao_resultado_jud",
    label: "Resultado Judicial",
    parent: "producao",
  },
  { key: "clientes", label: "Clientes", parent: null },
  { key: "processos", label: "Processos", parent: null },
  { key: "financeiro", label: "Financeiro", parent: null },
  {
    key: "financeiro_entradas",
    label: "Receitas / Honorários",
    parent: "financeiro",
  },
  {
    key: "financeiro_saidas",
    label: "Despesas / Saídas",
    parent: "financeiro",
  },
  { key: "controles", label: "Controles", parent: null },
  { key: "colaboradores", label: "Colaboradores", parent: null },
  { key: "remuneracoes", label: "Remunerações", parent: null },
  { key: "modelos", label: "Modelos", parent: null },
  { key: "relatorios", label: "Relatórios", parent: null },
  { key: "relatorios_extrato", label: "Extrato Geral", parent: "relatorios" },
  { key: "relatorios_clientes", label: "Por Cliente", parent: "relatorios" },
  {
    key: "relatorios_folha",
    label: "Folha de Pagamento",
    parent: "relatorios",
  },
  { key: "relatorios_fluxo", label: "Fluxo de Caixa", parent: "relatorios" },
  {
    key: "relatorios_recibo",
    label: "Recibo ao Cliente",
    parent: "relatorios",
  },
  { key: "gerenciador", label: "Gerenciador", parent: null },
  { key: "configuracoes", label: "Configurações", parent: null },
  { key: "usuarios", label: "Usuários", parent: null },
] as const;

export const ACOES = [
  { key: "ver", label: "Ver" },
  { key: "criar", label: "Criar" },
  { key: "editar", label: "Editar" },
  { key: "excluir", label: "Excluir" },
] as const;

export type ModuloKey = (typeof MODULOS)[number]["key"];
export type AcaoKey = (typeof ACOES)[number]["key"];
export type Permissoes = Record<string, string[]>;

const FULL: string[] = ["ver", "criar", "editar", "excluir"];
const VER: string[] = ["ver"];
const NONE: string[] = [];

// Sub-módulos que existem apenas para controle de VER (sem CRUD próprio)
const SUB_MODULOS = new Set<string>(
  MODULOS.filter((m) => m.parent !== null).map((m) => m.key)
);

export function isSubModulo(key: string): boolean {
  return SUB_MODULOS.has(key);
}

export const DEFAULTS_POR_CATEGORIA: Record<string, Permissoes> = {
  "Administrador(a)": {
    crm: FULL,
    producao: FULL,
    clientes: FULL,
    processos: FULL,
    financeiro: FULL,
    controles: FULL,
    colaboradores: FULL,
    remuneracoes: FULL,
    modelos: FULL,
    relatorios: FULL,
    gerenciador: FULL,
    configuracoes: FULL,
    usuarios: FULL,
  },
  "Sócio(a)": {
    crm: FULL,
    producao: FULL,
    clientes: FULL,
    processos: FULL,
    financeiro: FULL,
    controles: FULL,
    colaboradores: FULL,
    remuneracoes: FULL,
    modelos: FULL,
    relatorios: FULL,
    gerenciador: FULL,
    configuracoes: VER,
    usuarios: VER,
  },
  "Advogado(a)": {
    crm: ["ver", "criar", "editar"],
    producao: FULL,
    clientes: ["ver", "criar", "editar"],
    processos: FULL,
    financeiro: VER,
    controles: FULL,
    colaboradores: VER,
    remuneracoes: NONE,
    modelos: ["ver", "criar", "editar"],
    relatorios: VER,
    relatorios_folha: NONE,
    gerenciador: VER,
    configuracoes: NONE,
    usuarios: NONE,
  },
  "Estagiário(a)": {
    crm: VER,
    producao: VER,
    producao_resultado_adm: NONE,
    producao_resultado_jud: NONE,
    clientes: VER,
    processos: ["ver", "criar", "editar"],
    financeiro: NONE,
    controles: ["ver", "criar", "editar"],
    colaboradores: VER,
    remuneracoes: NONE,
    modelos: VER,
    relatorios: NONE,
    gerenciador: NONE,
    configuracoes: NONE,
    usuarios: NONE,
  },
  "Colaborador(a)": {
    crm: NONE,
    producao: NONE,
    clientes: VER,
    processos: VER,
    financeiro: NONE,
    controles: NONE,
    colaboradores: VER,
    remuneracoes: NONE,
    modelos: VER,
    relatorios: NONE,
    gerenciador: NONE,
    configuracoes: NONE,
    usuarios: NONE,
  },
};

export function resolvePermissoes(
  categoria: string,
  stored: Permissoes | null
): Permissoes {
  const defaults = DEFAULTS_POR_CATEGORIA[categoria] ?? {};
  const result: Permissoes = {};

  for (const { key, parent } of MODULOS) {
    if (stored && key in stored) {
      // Valor explicitamente armazenado (inclui arrays vazios = sem acesso)
      result[key] = stored[key];
    } else if (key in defaults) {
      // Padrão da categoria
      result[key] = defaults[key];
    } else if (parent !== null) {
      // Sub-módulo sem valor explícito: herda "ver" do módulo pai
      const parentPerms =
        stored && parent in stored
          ? stored[parent]
          : (defaults[parent] ?? NONE);
      result[key] = parentPerms.includes("ver") ? VER : NONE;
    } else {
      result[key] = NONE;
    }
  }

  return result;
}

export function hasPermission(
  user: SessionUser,
  modulo: string,
  acao: string
): boolean {
  const perms = user.permissoes[modulo];
  if (perms !== undefined) return perms.includes(acao);

  // Sub-módulo não presente na sessão: herda do pai
  const parent = MODULOS.find((m) => m.key === modulo)?.parent;
  if (parent) return (user.permissoes[parent] ?? []).includes(acao);

  // Módulo de nível superior ausente (sessão criada antes do módulo existir):
  // faz fallback nos defaults da categoria para não exigir novo login.
  const defaults = DEFAULTS_POR_CATEGORIA[user.categoria] ?? {};
  return (defaults[modulo] ?? NONE).includes(acao);
}
