import type { SessionUser } from "./session";

export const MODULOS = [
  { key: "clientes", label: "Clientes" },
  { key: "processos", label: "Processos" },
  { key: "financeiro", label: "Financeiro" },
  { key: "controles", label: "Controles" },
  { key: "colaboradores", label: "Colaboradores" },
  { key: "remuneracoes", label: "Remunerações" },
  { key: "modelos", label: "Modelos" },
  { key: "configuracoes", label: "Configurações" },
  { key: "usuarios", label: "Usuários" },
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

export const DEFAULTS_POR_CATEGORIA: Record<string, Permissoes> = {
  "Administrador(a)": {
    clientes: FULL,
    processos: FULL,
    financeiro: FULL,
    controles: FULL,
    colaboradores: FULL,
    remuneracoes: FULL,
    modelos: FULL,
    configuracoes: FULL,
    usuarios: FULL,
  },
  "Sócio(a)": {
    clientes: FULL,
    processos: FULL,
    financeiro: FULL,
    controles: FULL,
    colaboradores: FULL,
    remuneracoes: FULL,
    modelos: FULL,
    configuracoes: VER,
    usuarios: VER,
  },
  "Advogado(a)": {
    clientes: ["ver", "criar", "editar"],
    processos: FULL,
    financeiro: VER,
    controles: FULL,
    colaboradores: VER,
    remuneracoes: VER,
    modelos: ["ver", "criar", "editar"],
    configuracoes: NONE,
    usuarios: NONE,
  },
  "Estagiário(a)": {
    clientes: VER,
    processos: ["ver", "criar", "editar"],
    financeiro: NONE,
    controles: ["ver", "criar", "editar"],
    colaboradores: VER,
    remuneracoes: NONE,
    modelos: VER,
    configuracoes: NONE,
    usuarios: NONE,
  },
  "Colaborador(a)": {
    clientes: VER,
    processos: VER,
    financeiro: NONE,
    controles: NONE,
    colaboradores: VER,
    remuneracoes: NONE,
    modelos: VER,
    configuracoes: NONE,
    usuarios: NONE,
  },
};

export function resolvePermissoes(
  categoria: string,
  stored: Permissoes | null
): Permissoes {
  const defaults = DEFAULTS_POR_CATEGORIA[categoria] ?? {};
  if (!stored) return defaults;
  // merge: stored overrides defaults module by module
  const result: Permissoes = {};
  for (const { key } of MODULOS) {
    result[key] = stored[key] ?? defaults[key] ?? NONE;
  }
  return result;
}

export function hasPermission(
  user: SessionUser,
  modulo: string,
  acao: string
): boolean {
  return (user.permissoes[modulo] ?? []).includes(acao);
}
