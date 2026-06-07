import type { Permissoes } from "./permissoes";

export const CATEGORIAS = [
  "Sócio(a)",
  "Advogado(a)",
  "Estagiário(a)",
  "Colaborador(a)",
  "Administrador(a)",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

export interface Usuario {
  id: string;
  login: string;
  nome: string;
  categoria: string;
  colaborador_id: string | null;
  validade: string | null;
  ultimo_acesso: string | null;
  ativo: boolean;
  permissoes: Permissoes | null;
  created_at: string;
}

export interface ColaboradorOption {
  id: string;
  nome: string;
  cargo: string;
}
