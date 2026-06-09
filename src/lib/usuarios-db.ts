import sql from "./db";

export {
  CATEGORIAS,
  type Categoria,
  type Usuario,
  type ColaboradorOption,
} from "./usuarios-types";
import type { Usuario, ColaboradorOption } from "./usuarios-types";
import type { Permissoes } from "./permissoes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): Usuario {
  return {
    id: String(r.id),
    login: String(r.login),
    nome: String(r.nome),
    categoria: String(r.categoria),
    colaborador_id: r.colaborador_id ? String(r.colaborador_id) : null,
    validade: r.validade ? String(r.validade) : null,
    ultimo_acesso: r.ultimo_acesso ? String(r.ultimo_acesso) : null,
    ativo: Boolean(r.ativo),
    permissoes: r.permissoes ? (r.permissoes as Permissoes) : null,
    created_at: String(r.created_at),
    tarefas_pendentes: Number(r.tarefas_pendentes ?? 0),
    controles_pendentes: Number(r.controles_pendentes ?? 0),
  };
}

export async function getAllUsuarios(): Promise<Usuario[]> {
  const rows = await sql`
    SELECT
      u.id::text, u.login, u.nome, u.categoria, u.colaborador_id::text,
      u.validade::text, u.ultimo_acesso::text, u.ativo, u.permissoes, u.created_at::text,
      COUNT(t.id) FILTER (WHERE t.status IN ('Pendente', 'Em andamento'))::int AS tarefas_pendentes,
      COUNT(c.id) FILTER (WHERE c.status IS NULL OR c.status = 'em_andamento')::int AS controles_pendentes
    FROM usuarios u
    LEFT JOIN tarefas_processo t ON t.responsavel = u.login AND t.status != 'Cancelada'
    LEFT JOIN controles c ON c.responsavel_id = u.id AND (c.status IS NULL OR c.status = 'em_andamento')
    GROUP BY u.id
    ORDER BY u.nome ASC
  `;
  return rows.map(mapRow);
}

export async function getUsuarioById(id: string): Promise<Usuario | null> {
  const rows = await sql`
    SELECT id::text, login, nome, categoria, colaborador_id::text,
           validade::text, ultimo_acesso::text, ativo, permissoes, created_at::text
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

export async function getColaboradoresForSelect(): Promise<
  ColaboradorOption[]
> {
  const rows = await sql`
    SELECT id::text, nome, cargo
    FROM colaboradores
    WHERE status = 'ativo'
    ORDER BY nome ASC
  `;
  return rows.map((r) => ({
    id: String(r.id),
    nome: String(r.nome),
    cargo: String(r.cargo),
  }));
}
