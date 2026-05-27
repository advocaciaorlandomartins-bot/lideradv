import sql from "./db";

export {
  MAX_USUARIOS,
  CATEGORIAS,
  type Categoria,
  type Usuario,
} from "./usuarios-types";
import type { Usuario } from "./usuarios-types";

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

export async function getSenhaHash(id: string): Promise<string | null> {
  const rows =
    await sql`SELECT senha_hash FROM usuarios WHERE id = ${id}::uuid LIMIT 1`;
  return rows.length > 0 ? String(rows[0].senha_hash) : null;
}
