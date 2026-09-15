import "server-only";
import sql from "./db";

/**
 * cliente.status (ativo/inativo) e processo.status (ativo/arquivado) são
 * campos totalmente independentes no schema — nada nunca sincronizou um
 * com o outro. Isso deixava clientes marcados "Ativo" na tela mesmo com
 * TODOS os processos já arquivados (achado real: 6 clientes no sistema
 * nesse estado), um conflito visual confuso reportado pelo usuário.
 *
 * Chame depois de qualquer UPDATE que arquive ou reabra um processo — só
 * mexe no cliente quando isso muda o resultado geral (nenhum processo
 * aberto restante, ou o primeiro processo voltando a ficar aberto), nunca
 * à toa.
 */
export async function sincronizarStatusClienteAposMudarProcesso(
  processoId: string
): Promise<void> {
  const [proc] = await sql`
    SELECT client_id::text FROM processos WHERE id = ${processoId}::uuid
  `.catch(() => []);
  const clienteId = proc?.client_id as string | undefined;
  if (!clienteId) return;

  const [restantes] = await sql`
    SELECT COUNT(*)::int as total
    FROM processos
    WHERE client_id = ${clienteId}::uuid
      AND deleted_at IS NULL
      AND status != 'arquivado'
  `.catch(() => [{ total: 1 }]);

  const temProcessoAberto = Number(restantes?.total ?? 1) > 0;

  await sql`
    UPDATE clients
    SET status = ${temProcessoAberto ? "ativo" : "inativo"}
    WHERE id = ${clienteId}::uuid
      AND deleted_at IS NULL
      AND status != ${temProcessoAberto ? "ativo" : "inativo"}
  `.catch((e) => {
    console.error(
      "[cliente-status-sync] falha ao sincronizar status do cliente:",
      e
    );
    return null;
  });
}
