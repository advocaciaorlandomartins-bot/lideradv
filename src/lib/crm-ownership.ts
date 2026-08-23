import sql from "./db";
import { getColaboradorIdForUser } from "./usuarios-db";
import type { SessionUser } from "./session";

/**
 * Lead sem responsavel_id é considerado do "pool" compartilhado — qualquer
 * um com crm:editar pode reivindicar/editar. Uma vez atribuído a alguém,
 * só esse colaborador (ou Admin/Sócio) pode editar/excluir/mover — mesma
 * regra de dono já usada em Processos e Compromissos.
 */
export async function podeGerenciarLead(
  session: SessionUser,
  leadId: string
): Promise<boolean> {
  if (
    session.categoria === "Administrador(a)" ||
    session.categoria === "Sócio(a)"
  )
    return true;

  const [row] = await sql`
    SELECT responsavel_id::text FROM crm_leads WHERE id = ${leadId}::uuid
  `;
  if (!row) return false;
  if (!row.responsavel_id) return true;

  const colaboradorId = await getColaboradorIdForUser(session.id);
  return !!colaboradorId && row.responsavel_id === colaboradorId;
}
