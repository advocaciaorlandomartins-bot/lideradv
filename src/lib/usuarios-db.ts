import sql from "./db";

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
  validade: string | null; // ISO date string
  ultimo_acesso: string | null; // ISO timestamp string
  ativo: boolean;
  created_at: string;
}

function mapRow(r: Record<string, unknown>): Usuario {
  return {
    id: String(r.id),
    login: String(r.login),
    nome: String(r.nome),
    categoria: String(r.categoria),
    validade: r.validade ? String(r.validade) : null,
    ultimo_acesso: r.ultimo_acesso ? String(r.ultimo_acesso) : null,
    ativo: Boolean(r.ativo),
    created_at: String(r.created_at),
  };
}

export async function getAllUsuarios(): Promise<Usuario[]> {
  const rows = await sql`
    SELECT id::text, login, nome, categoria,
           validade::text, ultimo_acesso::text, ativo, created_at::text
    FROM usuarios
    ORDER BY nome ASC
  `;
  return rows.map(mapRow);
}

export async function getUsuarioById(id: string): Promise<Usuario | null> {
  const rows = await sql`
    SELECT id::text, login, nome, categoria,
           validade::text, ultimo_acesso::text, ativo, created_at::text
    FROM usuarios
    WHERE id = ${id}::uuid
    LIMIT 1
  `;
  return rows.length > 0 ? mapRow(rows[0]) : null;
}

export async function countAtivos(): Promise<number> {
  const rows =
    await sql`SELECT COUNT(*)::int AS n FROM usuarios WHERE ativo = TRUE`;
  return Number(rows[0]?.n ?? 0);
}

/** Returns the stored senha_hash for password verification */
export async function getSenhaHash(id: string): Promise<string | null> {
  const rows =
    await sql`SELECT senha_hash FROM usuarios WHERE id = ${id}::uuid LIMIT 1`;
  return rows.length > 0 ? String(rows[0].senha_hash) : null;
}
