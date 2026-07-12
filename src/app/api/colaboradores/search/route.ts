import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json([], { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);

  const rows = await sql`
    SELECT
      u.id::text   AS usuario_id,
      u.login,
      col.nome,
      col.telefone
    FROM colaboradores col
    JOIN usuarios u ON u.colaborador_id = col.id
    WHERE col.status = 'ativo'
      AND u.ativo = true
      AND col.nome ILIKE ${"%" + q + "%"}
    ORDER BY col.nome
    LIMIT 10
  `;

  return NextResponse.json(
    rows.map((r) => ({
      usuarioId: String(r.usuario_id),
      login: String(r.login),
      nome: String(r.nome),
      telefone: r.telefone ? String(r.telefone) : null,
    }))
  );
}
