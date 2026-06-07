"use server";

import sql from "./db";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";

interface CreateDocumentoInput {
  entityType: "processo" | "cliente" | "pericia";
  entityId: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  caminho: string;
  url: string;
}

export async function createDocumentoAction(
  data: CreateDocumentoInput
): Promise<{ id: string } | { error: string }> {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "criar"))
    return { error: "Sem permissão." };

  try {
    const rows = await sql`
      INSERT INTO documentos (entity_type, entity_id, nome, tipo, tamanho, caminho, url)
      VALUES (
        ${data.entityType},
        ${data.entityId}::uuid,
        ${data.nome},
        ${data.tipo},
        ${data.tamanho},
        ${data.caminho},
        ${data.url}
      )
      RETURNING id::text
    `;
    return { id: rows[0].id };
  } catch (err) {
    console.error("createDocumentoAction DB error:", err);
    return { error: "Erro ao registrar documento." };
  }
}

export async function deleteDocumentoAction(id: string): Promise<void> {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "excluir")) return;

  try {
    await sql`DELETE FROM documentos WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("deleteDocumentoAction DB error:", err);
  }
}
