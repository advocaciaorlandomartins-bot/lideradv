import sql from "./db";
import { hasPermission } from "./permissoes";
import { getColaboradorIdForUser } from "./usuarios-db";
import type { SessionUser } from "./session";

/**
 * true se o usuário pode mexer neste processo — ou porque tem
 * processos_ver_todos, ou porque é o responsável por ele. A página de
 * detalhe do processo (src/app/dashboard/processos/[id]/page.tsx) já
 * aplica essa mesma regra na LEITURA; sem replicar aqui, as ACTIONS de
 * escrita aceitavam qualquer processoId — a página bloqueava, mas quem
 * soubesse/adivinhasse o UUID editava/excluía direto pela action.
 */
export async function podeEditarProcesso(
  session: SessionUser,
  processoId: string
): Promise<boolean> {
  if (hasPermission(session, "processos_ver_todos", "ver")) return true;
  const colaboradorId = await getColaboradorIdForUser(session.id);
  if (!colaboradorId) return false;
  const [row] = await sql`
    SELECT responsavel_id::text FROM processos WHERE id = ${processoId}::uuid
  `;
  return row?.responsavel_id === colaboradorId;
}
