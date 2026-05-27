import sql from "./db";

export interface ModeloDocumento {
  id: string;
  titulo: string;
  categoria: string | null;
  descricao: string | null;
  conteudo: string;
  ativo: boolean;
  usar_timbrado: boolean;
  created_at_formatted: string;
  updated_at_formatted: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): ModeloDocumento {
  return {
    id: r.id,
    titulo: r.titulo,
    categoria: r.categoria ?? null,
    descricao: r.descricao ?? null,
    conteudo: r.conteudo,
    ativo: r.ativo,
    usar_timbrado: r.usar_timbrado ?? true,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
    updated_at_formatted: new Date(r.updated_at).toLocaleDateString("pt-BR"),
  };
}

export async function getAllModelos(): Promise<ModeloDocumento[]> {
  const rows = await sql`
    SELECT id::text, titulo, categoria, descricao, conteudo, ativo, usar_timbrado, created_at, updated_at
    FROM modelos_documento
    ORDER BY categoria NULLS LAST, titulo
  `;
  return rows.map(mapRow);
}

export async function getModelosAtivos(): Promise<ModeloDocumento[]> {
  const rows = await sql`
    SELECT id::text, titulo, categoria, descricao, conteudo, ativo, usar_timbrado, created_at, updated_at
    FROM modelos_documento
    WHERE ativo = TRUE
    ORDER BY categoria NULLS LAST, titulo
  `;
  return rows.map(mapRow);
}

export async function getModeloById(
  id: string
): Promise<ModeloDocumento | null> {
  const rows = await sql`
    SELECT id::text, titulo, categoria, descricao, conteudo, ativo, usar_timbrado, created_at, updated_at
    FROM modelos_documento
    WHERE id = ${id}::uuid
  `;
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}
