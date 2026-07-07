import { NextResponse } from "next/server";
import { getDownloadUrl } from "@vercel/blob";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const rows = await sql`
    SELECT url, nome FROM documentos WHERE id = ${id}::uuid LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Documento não encontrado." },
      { status: 404 }
    );
  }

  const { url, nome } = rows[0] as { url: string; nome: string };

  try {
    const downloadUrl = await getDownloadUrl(url);
    return NextResponse.redirect(downloadUrl);
  } catch {
    // Fallback: redirect directly (for old public URLs or non-blob URLs)
    return NextResponse.redirect(url);
  }
}
