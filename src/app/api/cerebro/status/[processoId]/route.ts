import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ processoId: string }> }
) {
  const session = await getSession();
  if (!session?.id)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const { processoId } = await params;

  if (!UUID_RE.test(processoId)) {
    return NextResponse.json({ analises: [] });
  }

  try {
    const analises = await sql`
      SELECT id::text, tipo, titulo, analise, risco, probabilidade_sucesso,
             proxima_acao, base_legal, metadata, created_at
      FROM cerebro_analises
      WHERE processo_id = ${processoId}::uuid
      ORDER BY created_at DESC
      LIMIT 20
    `;
    return NextResponse.json({ analises });
  } catch (err) {
    console.error("[cerebro/status]", err);
    return NextResponse.json({ analises: [] });
  }
}
