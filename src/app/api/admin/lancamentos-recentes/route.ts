import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/lancamentos-recentes
 * Mostra os últimos lançamentos de "Meu Financeiro" de TODOS os usuários,
 * pra diagnosticar se um registro criado via WhatsApp (PrevBot) caiu na
 * conta certa e com a data certa. Requer sessão de administrador.
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
    SELECT
      m.id::text,
      m.usuario_id::text,
      u.login          AS usuario_login,
      m.tipo,
      m.categoria,
      m.descricao,
      m.valor,
      m.data::text,
      m.status,
      m.created_at
    FROM meu_financeiro_lancamentos m
    LEFT JOIN usuarios u ON u.id = m.usuario_id
    ORDER BY m.created_at DESC
    LIMIT 20
  `;

  return NextResponse.json({ total: rows.length, lancamentos: rows });
}
