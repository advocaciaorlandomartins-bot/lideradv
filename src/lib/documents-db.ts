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
