import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/cron-status
 * Mostra as últimas execuções registradas pelos crons (independe dos logs
 * da Vercel, que no plano Hobby só guardam 12h de histórico).
 * Requer sessão de administrador.
 */
export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.categoria !== "Administrador(a)")
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 }
    );

  const rows = await sql`
    SELECT id::text, rota, executado_em, processados, enviados, erros, detalhe
    FROM cron_execucoes
    ORDER BY executado_em DESC
    LIMIT 50
  `;

  return NextResponse.json({
    total: rows.length,
    execucoes: rows,
  });
}
