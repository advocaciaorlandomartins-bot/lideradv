import sql from "./db";
import type { SessionUser } from "./session";
import { hasPermission } from "./permissoes";
import { getColaboradorIdForUser } from "./usuarios-db";

/**
 * Controle de acesso a processos nas rotas de API.
 *
 * As páginas do dashboard já restringiam processos ao responsável quando o
 * usuário não tem "processos_ver_todos" (ver src/app/dashboard/processos/**),
 * mas as rotas de API não faziam essa checagem — bastava trocar o UUID na
 * querystring para ler dados/documentos de qualquer processo do escritório.
 */
export async function podeAcessarProcesso(
  session: SessionUser,
  processoId: string
): Promise<boolean> {
  if (!hasPermission(session, "processos", "ver")) return false;
  if (hasPermission(session, "processos_ver_todos", "ver")) return true;

  const colaboradorId = await getColaboradorIdForUser(session.id);
  if (!colaboradorId) return false;

  const rows = await sql`
    SELECT 1 FROM processos
    WHERE id = ${processoId}::uuid
      AND deleted_at IS NULL
      AND responsavel_id = ${colaboradorId}::uuid
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Acesso a um cliente. Clientes não são restritos por responsável no sistema
 * (a listagem mostra todos para quem tem "clientes:ver"), então a checagem é
 * de permissão + existência do registro.
 */
export async function podeAcessarCliente(
  session: SessionUser,
  clienteId: string
): Promise<boolean> {
  if (!hasPermission(session, "clientes", "ver")) return false;

  const rows = await sql`
    SELECT 1 FROM clients
    WHERE id = ${clienteId}::uuid AND deleted_at IS NULL
    LIMIT 1
  `;
  return rows.length > 0;
}

/**
 * Acesso a uma perícia — herda o acesso do processo vinculado quando existe;
 * senão cai na permissão de controles.
 */
export async function podeAcessarPericia(
  session: SessionUser,
  periciaId: string
): Promise<boolean> {
  const rows = await sql`
    SELECT processo_id::text, client_id::text
    FROM pericias WHERE id = ${periciaId}::uuid LIMIT 1
  `;
  if (rows.length === 0) return false;

  const processoId = rows[0].processo_id as string | null;
  if (processoId) return podeAcessarProcesso(session, processoId);

  const clientId = rows[0].client_id as string | null;
  if (clientId) return podeAcessarCliente(session, clientId);

  return hasPermission(session, "controles", "ver");
}

/**
 * Acesso a uma entidade genérica de documento.
 */
export async function podeAcessarEntidade(
  session: SessionUser,
  entityType: "processo" | "cliente" | "pericia",
  entityId: string
): Promise<boolean> {
  if (entityType === "processo") return podeAcessarProcesso(session, entityId);
  if (entityType === "cliente") return podeAcessarCliente(session, entityId);
  return podeAcessarPericia(session, entityId);
}
