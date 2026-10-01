import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Serve a foto de perfil do colaborador. Blob privado (único modo que o
 * store desta conta aceita — "public" é rejeitado) exige o header
 * Authorization pra ser lido, que um <img src="..."> nunca manda — por
 * isso toda referência a foto no app aponta pra esta rota, que busca o
 * blob aqui no servidor (com o token) e devolve os bytes, mesmo padrão já
 * usado em /api/documentos/download.
 *
 * Sem controle de acesso por colaborador específico: a foto já aparece
 * pra qualquer usuário logado em listagens/ranking/carga compartilhados
 * do escritório inteiro, então restringir aqui não protegeria nada —
 * só exige sessão válida.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const rows = await sql`
    SELECT foto_url FROM colaboradores WHERE id = ${id}::uuid
  `;
  const url = rows[0]?.foto_url as string | undefined;
  if (!url) {
    return NextResponse.json({ error: "Sem foto." }, { status: 404 });
  }

  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const blobRes = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!blobRes.ok || !blobRes.body) {
      console.error(
        `[colaboradores/foto] fetch do blob falhou (${blobRes.status}) para ${id}`
      );
      return NextResponse.json(
        { error: "Não foi possível carregar a foto." },
        { status: 502 }
      );
    }
    return new NextResponse(blobRes.body, {
      headers: {
        "Content-Type": blobRes.headers.get("content-type") ?? "image/jpeg",
        // Avatar reaparece em várias telas no mesmo request de página —
        // cache curto evita refetch repetido sem deixar foto trocada
        // demorando muito pra atualizar em todo lugar.
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (err) {
    console.error(`[colaboradores/foto] falha inesperada para ${id}:`, err);
    return NextResponse.json(
      { error: "Não foi possível carregar a foto." },
      { status: 502 }
    );
  }
}
