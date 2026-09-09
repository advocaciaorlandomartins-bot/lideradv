import sql from "./db";

export interface Documento {
  id: string;
  entity_type: "processo" | "cliente" | "pericia";
  entity_id: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  caminho: string;
  url: string;
  created_at_formatted: string;
}

export async function getDocumentosAllByClientId(
  clientId: string
): Promise<Documento[]> {
  const rows = await sql`
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      nome,
      tipo,
      tamanho,
      caminho,
      url,
      created_at
    FROM documentos
    WHERE
      (entity_type = 'cliente' AND entity_id = ${clientId}::uuid)
      OR (entity_type = 'processo' AND entity_id IN (
        SELECT id FROM processos WHERE client_id = ${clientId}::uuid
      ))
    ORDER BY created_at DESC
  `;

  return rows.map((r) => ({
    id: r.id,
    entity_type: r.entity_type as "processo" | "cliente" | "pericia",
    entity_id: r.entity_id,
    nome: r.nome,
    tipo: r.tipo ?? null,
    tamanho: r.tamanho ? Number(r.tamanho) : null,
    caminho: r.caminho,
    url: r.url,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
  }));
}

export interface DocumentoGlobal extends Documento {
  clienteId: string | null;
  clienteNome: string | null;
  processoId: string | null;
  processoNumero: string | null;
  processoTipoAcao: string | null;
}

/**
 * Biblioteca de documentos do escritório inteiro — hoje só dava pra achar um
 * arquivo abrindo cliente por cliente (aba Documentos). Junta cliente e
 * processo (documentos vinculados diretamente a um processo aparecem com o
 * nome do cliente dono, via processos.client_id) pra dar pra buscar/filtrar
 * de um lugar só. Documentos de perícia ficam de fora — continuam só na
 * própria perícia, onde já fazem sentido junto com o evento.
 */
export async function getAllDocumentos(): Promise<DocumentoGlobal[]> {
  const rows = await sql`
    SELECT
      d.id::text,
      d.entity_type,
      d.entity_id::text,
      d.nome,
      d.tipo,
      d.tamanho,
      d.caminho,
      d.url,
      d.created_at,
      CASE WHEN d.entity_type = 'cliente' THEN cd.id::text ELSE cp.id::text END AS cliente_id,
      CASE WHEN d.entity_type = 'cliente' THEN cd.name ELSE cp.name END AS cliente_nome,
      p.id::text AS processo_id,
      p.numero AS processo_numero,
      p.tipo_acao AS processo_tipo_acao
    FROM documentos d
    LEFT JOIN processos p
      ON d.entity_type = 'processo' AND p.id = d.entity_id AND p.deleted_at IS NULL
    LEFT JOIN clients cd
      ON d.entity_type = 'cliente' AND cd.id = d.entity_id AND cd.deleted_at IS NULL
    LEFT JOIN clients cp
      ON d.entity_type = 'processo' AND cp.id = p.client_id
    WHERE (d.entity_type = 'cliente' AND cd.id IS NOT NULL)
       OR (d.entity_type = 'processo' AND p.id IS NOT NULL)
    ORDER BY d.created_at DESC
    LIMIT 500
  `;

  return rows.map((r) => ({
    id: r.id,
    entity_type: r.entity_type as "processo" | "cliente" | "pericia",
    entity_id: r.entity_id,
    nome: r.nome,
    tipo: r.tipo ?? null,
    tamanho: r.tamanho ? Number(r.tamanho) : null,
    caminho: r.caminho,
    url: r.url,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
    clienteId: r.cliente_id ?? null,
    clienteNome: r.cliente_nome ?? null,
    processoId: r.processo_id ?? null,
    processoNumero: r.processo_numero ?? null,
    processoTipoAcao: r.processo_tipo_acao ?? null,
  }));
}

export async function getDocumentosByEntityId(
  entityType: "processo" | "cliente" | "pericia",
  entityId: string
): Promise<Documento[]> {
  const rows = await sql`
    SELECT
      id::text,
      entity_type,
      entity_id::text,
      nome,
      tipo,
      tamanho,
      caminho,
      url,
      created_at
    FROM documentos
    WHERE entity_type = ${entityType}
      AND entity_id = ${entityId}::uuid
    ORDER BY created_at DESC
  `;

  return rows.map((r) => ({
    id: r.id,
    entity_type: r.entity_type as "processo" | "cliente" | "pericia",
    entity_id: r.entity_id,
    nome: r.nome,
    tipo: r.tipo ?? null,
    tamanho: r.tamanho ? Number(r.tamanho) : null,
    caminho: r.caminho,
    url: r.url,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
  }));
}
