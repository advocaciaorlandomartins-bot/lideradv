"use server";

import { del } from "@vercel/blob";
import sql from "./db";
import { getSession } from "./session";
import type { SessionUser } from "./session";
import { hasPermission } from "./permissoes";
import { podeAcessarEntidade, podeAcessarColaborador } from "./acesso";

type EntityType = "processo" | "cliente" | "pericia" | "colaborador";

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
// anexar documentos a qualquer cliente. "colaborador" fica fora deste mapa
// — autoatendimento de "Meus Dados" não exige colaboradores:criar/excluir,
// só podeAcessarColaborador (admin ou o próprio).
const MODULO_POR_ENTITY_TYPE: Record<
  Exclude<EntityType, "colaborador">,
  string
> = {
  processo: "processos",
  cliente: "clientes",
  pericia: "controles",
};

async function podeMexerNaEntidade(
  session: SessionUser,
  entityType: EntityType,
  entityId: string,
  acao: "criar" | "excluir"
): Promise<boolean> {
  if (entityType === "colaborador")
    return podeAcessarColaborador(session, entityId);
  if (!hasPermission(session, MODULO_POR_ENTITY_TYPE[entityType], acao))
    return false;
  return podeAcessarEntidade(session, entityType, entityId);
}

export async function createDocumentoAction(
  data: CreateDocumentoInput
): Promise<{ id: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };
  // hasPermission só checa o módulo ("processos:criar" etc) — sem isso,
  // qualquer usuário com esse módulo liberado podia anexar documento em
  // QUALQUER processo/cliente/perícia, não só nos que tem acesso.
  if (
    !(await podeMexerNaEntidade(
      session,
      data.entityType,
      data.entityId,
      "criar"
    ))
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
  url?: string
): Promise<{ error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Sem permissão." };

  // O entityType do documento vem SEMPRE do banco agora, nunca do argumento
  // da action — antes era o chamador quem informava, e como o módulo de
  // permissão verificado dependia desse valor, um usuário com processos:excluir
  // (mas sem clientes:excluir) podia apagar um documento de cliente só
  // chamando a action com entityType:"processo", já que nada conferia se o
  // documento realmente era de um processo.
  const [doc] = await sql`
    SELECT entity_type, entity_id::text FROM documentos WHERE id = ${id}::uuid
  `;
  if (!doc) return { error: "Documento não encontrado." };
  const entityType = doc.entity_type as EntityType;
  const entityId = doc.entity_id as string;

  if (!(await podeMexerNaEntidade(session, entityType, entityId, "excluir")))
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
