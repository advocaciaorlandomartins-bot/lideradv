import { NextResponse } from "next/server";
import { head } from "@vercel/blob";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "processos", "ver")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  // Verifica que o documento existe e pertence a uma entidade ativa do sistema
  const rows = await sql`
    SELECT d.url, d.nome
    FROM documentos d
    WHERE d.id = ${id}::uuid
      AND (
        -- documento de processo ativo
        (d.entity_type = 'processo' AND EXISTS (
          SELECT 1 FROM processos p
          WHERE p.id = d.entity_id AND p.deleted_at IS NULL
        ))
        OR
        -- documento de cliente ativo
        (d.entity_type = 'cliente' AND EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id = d.entity_id AND c.deleted_at IS NULL
        ))
      )
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Documento não encontrado." },
      { status: 404 }
    );
  }

  const { url } = rows[0] as { url: string; nome: string };

  try {
    // Para blobs privados, head() retorna um downloadUrl assinado
    const blob = await head(url);
    const target = blob.downloadUrl ?? url;
    return NextResponse.redirect(target);
  } catch {
    // Fallback para URLs públicas ou externas
    return NextResponse.redirect(url);
  }
}
