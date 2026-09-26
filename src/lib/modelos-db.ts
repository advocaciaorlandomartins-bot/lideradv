import sql from "./db";
import { isValidBlocks, type Block } from "./modelo-blocks";

export interface PerguntaExtra {
  tag: string;
  label: string;
}

export interface ModeloDocumento {
  id: string;
  titulo: string;
  categoria: string | null;
  descricao: string | null;
  conteudo: string;
  conteudo_blocks: Block[] | null;
  ativo: boolean;
  usar_timbrado: boolean;
  usar_fundo_timbrado: boolean;
  requer_responsavel_legal: boolean;
  // Marca especificamente o(s) modelo(s) que /api/integracoes/prevbot/
  // contrato deve enviar automaticamente — separado de
  // requer_responsavel_legal (que só descreve o texto do modelo) pra não
  // colidir quando mais de um modelo tiver essa variante.
  usar_prevbot_contrato: boolean;
  perguntas_extras: PerguntaExtra[] | null;
  created_at_formatted: string;
  updated_at_formatted: string;
}

function isPerguntaExtra(v: unknown): v is PerguntaExtra {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return typeof p.tag === "string" && typeof p.label === "string";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): ModeloDocumento {
  const blocks = isValidBlocks(r.conteudo_blocks) ? r.conteudo_blocks : null;
  return {
    id: r.id,
    titulo: r.titulo,
    categoria: r.categoria ?? null,
    descricao: r.descricao ?? null,
    conteudo: r.conteudo,
    conteudo_blocks: blocks,
    ativo: r.ativo,
    usar_timbrado: r.usar_timbrado ?? true,
    usar_fundo_timbrado: r.usar_fundo_timbrado ?? true,
    requer_responsavel_legal: r.requer_responsavel_legal ?? false,
    usar_prevbot_contrato: r.usar_prevbot_contrato ?? false,
    perguntas_extras: Array.isArray(r.perguntas_extras)
      ? r.perguntas_extras.filter(isPerguntaExtra)
      : null,
    created_at_formatted: new Date(r.created_at).toLocaleDateString("pt-BR"),
    updated_at_formatted: new Date(r.updated_at).toLocaleDateString("pt-BR"),
  };
}

export async function getAllModelos(): Promise<ModeloDocumento[]> {
  const rows = await sql`
    SELECT id::text, titulo, categoria, descricao, conteudo, conteudo_blocks,
           ativo, usar_timbrado, usar_fundo_timbrado, requer_responsavel_legal, usar_prevbot_contrato, perguntas_extras, created_at, updated_at
    FROM modelos_documento
    ORDER BY categoria NULLS LAST, titulo
  `;
  return rows.map(mapRow);
}

export async function getModelosAtivos(): Promise<ModeloDocumento[]> {
  const rows = await sql`
    SELECT id::text, titulo, categoria, descricao, conteudo, conteudo_blocks,
           ativo, usar_timbrado, usar_fundo_timbrado, requer_responsavel_legal, usar_prevbot_contrato, perguntas_extras, created_at, updated_at
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
    SELECT id::text, titulo, categoria, descricao, conteudo, conteudo_blocks,
           ativo, usar_timbrado, usar_fundo_timbrado, requer_responsavel_legal, usar_prevbot_contrato, perguntas_extras, created_at, updated_at
    FROM modelos_documento
    WHERE id = ${id}::uuid
  `;
  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}
