import "server-only";
import sql from "./db";

export interface ConversaResumo {
  id: string;
  titulo: string;
  updatedAt: string;
}

export interface AnexoMeta {
  nome: string;
  mimeType: string;
}

export interface ToolTraceItem {
  name: string;
  label: string;
}

export interface MensagemPersistida {
  role: "user" | "assistant";
  content: string;
  anexos: AnexoMeta[] | null;
  toolTrace: ToolTraceItem[] | null;
}

export async function listarConversas(
  usuarioId: string
): Promise<ConversaResumo[]> {
  const rows = await sql`
    SELECT id::text, titulo, updated_at
    FROM iris_conversas
    WHERE usuario_id = ${usuarioId}::uuid
    ORDER BY updated_at DESC
    LIMIT 50
  `;
  return rows.map((r) => ({
    id: r.id as string,
    titulo: r.titulo as string,
    updatedAt: (r.updated_at as Date).toISOString(),
  }));
}

export async function obterConversa(
  usuarioId: string,
  conversaId: string
): Promise<{ id: string; titulo: string } | null> {
  const rows = await sql`
    SELECT id::text, titulo FROM iris_conversas
    WHERE id = ${conversaId}::uuid AND usuario_id = ${usuarioId}::uuid
  `;
  if (rows.length === 0) return null;
  return { id: rows[0].id as string, titulo: rows[0].titulo as string };
}

/**
 * Conversa mais recente do usuário, só se foi atualizada dentro da janela
 * (minutos) — usado pelo canal de WhatsApp (sem conceito de "conversa aberta
 * na tela") pra dar continuidade natural entre mensagens próximas no tempo
 * (ex: a Íris pergunta "qual das duas perícias?" e a resposta do usuário
 * precisa desse contexto), sem misturar com uma conversa de dias atrás.
 */
export async function obterConversaRecente(
  usuarioId: string,
  janelaMinutos: number
): Promise<string | null> {
  const rows = await sql`
    SELECT id::text FROM iris_conversas
    WHERE usuario_id = ${usuarioId}::uuid
      AND updated_at > NOW() - (${janelaMinutos} || ' minutes')::interval
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  return rows[0]?.id ? String(rows[0].id) : null;
}

export async function criarConversa(
  usuarioId: string,
  titulo: string
): Promise<string> {
  const rows = await sql`
    INSERT INTO iris_conversas (usuario_id, titulo)
    VALUES (${usuarioId}::uuid, ${titulo.slice(0, 255)})
    RETURNING id::text
  `;
  return rows[0].id as string;
}

export async function listarMensagens(
  conversaId: string
): Promise<MensagemPersistida[]> {
  const rows = await sql`
    SELECT role, content, anexos, tool_trace
    FROM iris_mensagens
    WHERE conversa_id = ${conversaId}::uuid
    ORDER BY created_at ASC
  `;
  return rows.map((r) => ({
    role: r.role as "user" | "assistant",
    content: r.content as string,
    anexos: (r.anexos as AnexoMeta[] | null) ?? null,
    toolTrace: (r.tool_trace as ToolTraceItem[] | null) ?? null,
  }));
}

export async function inserirMensagem(
  conversaId: string,
  role: "user" | "assistant",
  content: string,
  anexos: AnexoMeta[] | null,
  toolTrace: ToolTraceItem[] | null
): Promise<void> {
  await sql`
    INSERT INTO iris_mensagens (conversa_id, role, content, anexos, tool_trace)
    VALUES (
      ${conversaId}::uuid,
      ${role},
      ${content},
      ${anexos ? JSON.stringify(anexos) : null}::jsonb,
      ${toolTrace ? JSON.stringify(toolTrace) : null}::jsonb
    )
  `;
  await sql`
    UPDATE iris_conversas SET updated_at = NOW() WHERE id = ${conversaId}::uuid
  `;
}

export async function excluirConversa(
  usuarioId: string,
  conversaId: string
): Promise<boolean> {
  const rows = await sql`
    DELETE FROM iris_conversas
    WHERE id = ${conversaId}::uuid AND usuario_id = ${usuarioId}::uuid
    RETURNING id
  `;
  return rows.length > 0;
}
