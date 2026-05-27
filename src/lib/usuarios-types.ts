export const MAX_USUARIOS = 3;

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
  validade: string | null;
  ultimo_acesso: string | null;
  ativo: boolean;
  created_at: string;
}
