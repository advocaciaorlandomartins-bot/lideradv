import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

function authOk(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const expected = process.env.PREVBOT_API_KEY;
  if (!expected || !token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// Remove tudo que não é dígito e normaliza para 11 ou 13 dígitos
function normalizarTelefone(tel: string): string {
  const digits = tel.replace(/\D/g, "");
  // Remove o 55 do início se tiver 13 dígitos (55 + DDD + número)
  if (digits.length === 13 && digits.startsWith("55")) return digits.slice(2);
  return digits;
}

/**
 * GET /api/integracoes/prevbot/colaboradores
 *
 * Retorna todos os colaboradores ativos que têm telefone cadastrado
 * e um usuário do sistema vinculado. Usado pelo PrevBot para saber
 * quais números devem ser tratados como "usuário do escritório"
 * (modo financeiro/agenda), em vez de cliente.
 */
export async function GET(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const rows = await sql`
    SELECT
      col.id::text          AS colaborador_id,
      col.nome,
      col.telefone,
      col.cargo,
      u.id::text            AS usuario_id,
      u.login               AS usuario_login,
      u.categoria           AS usuario_categoria
    FROM colaboradores col
    INNER JOIN usuarios u ON u.colaborador_id = col.id AND u.ativo = true
    WHERE col.status   = 'ativo'
      AND col.telefone IS NOT NULL
      AND col.telefone <> ''
    ORDER BY col.nome
  `;

  const colaboradores = rows.map((r) => ({
    colaboradorId: String(r.colaborador_id),
    nome: String(r.nome),
    telefone: normalizarTelefone(String(r.telefone)),
    cargo: String(r.cargo),
    usuarioId: String(r.usuario_id),
    usuarioLogin: String(r.usuario_login),
    usuarioCategoria: String(r.usuario_categoria),
  }));

  return NextResponse.json({ colaboradores });
}
