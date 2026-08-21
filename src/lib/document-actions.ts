"use server";

import { del } from "@vercel/blob";
import sql from "./db";
import { getSession } from "./session";
import { hasPermission } from "./permissoes";

type EntityType = "processo" | "cliente" | "pericia";

interface CreateDocumentoInput {
  entityType: EntityType;
  entityId: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  caminho: string;
  url: string;
}

// Cada tipo de entidade é dono de um módulo de permissão diferente — usar
// sempre "processos" pra tudo deixava um Advogado(a) (sem clientes:excluir)
// apagar documentos de cliente, e um Estagiário(a) (sem clientes:criar)
// anexar documentos a qualquer cliente.
const MODULO_POR_ENTITY_TYPE: Record<EntityType, string> = {
  processo: "processos",
  cliente: "clientes",
  pericia: "controles",
};

export async function createDocumentoAction(
  data: CreateDocumentoInput
): Promise<{ id: string } | { error: string }> {
  const session = await getSession();
  if (
    !session ||
    !hasPermission(session, MODULO_POR_ENTITY_TYPE[data.entityType], "criar")
  )
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

export async function deleteDocumentoAction(
  id: string,
  url?: string,
  entityType: EntityType = "processo"
): Promise<{ error?: string }> {
  const session = await getSession();
  if (
    !session ||
    !hasPermission(session, MODULO_POR_ENTITY_TYPE[entityType], "excluir")
  )
    return { error: "Sem permissão." };

  try {
    await sql`DELETE FROM documentos WHERE id = ${id}::uuid`;
  } catch (err) {
    console.error("deleteDocumentoAction DB error:", err);
    return { error: "Erro ao excluir documento." };
  }

  if (url) {
    try {
      await del(url);
    } catch (err) {
      console.error("deleteDocumentoAction Blob error:", err);
    }
  }

  return {};
}
