import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getIntegracoesAuth } from "@/lib/integracoes-jwt";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = getIntegracoesAuth(req);
  if (!auth) {
    return NextResponse.json(
      { error: "Token inválido ou expirado" },
      { status: 401 }
    );
  }

  const rows = await sql`
    SELECT
      id::text,
      nome,
      cargo,
      email,
      -- Remove todos os caracteres não numéricos do telefone
      regexp_replace(COALESCE(telefone, ''), '[^0-9]', '', 'g') AS telefone,
      oab,
      status
    FROM colaboradores
    WHERE status = 'ativo'
    ORDER BY nome ASC
  `;

  return NextResponse.json({
    colaboradores: rows.map((r) => ({
      id: String(r.id),
      nome: String(r.nome),
      cargo: String(r.cargo),
      email: r.email ? String(r.email) : null,
      telefone: r.telefone ? String(r.telefone) : null,
      oab: r.oab ? String(r.oab) : null,
    })),
  });
}
