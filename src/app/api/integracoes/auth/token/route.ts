import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { jwtSign } from "@/lib/integracoes-jwt";

export const dynamic = "force-dynamic";

const TRINTA_DIAS = 60 * 60 * 24 * 30;

export async function POST(req: NextRequest) {
  const apiKey = process.env.PREVBOT_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Integração não configurada no servidor. Defina PREVBOT_API_KEY no Vercel.",
      },
      { status: 503 }
    );
  }

  let body: { colaborador_id?: string; api_key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { colaborador_id, api_key } = body;

  if (!api_key || api_key !== apiKey) {
    return NextResponse.json({ error: "api_key inválida" }, { status: 401 });
  }

  if (!colaborador_id) {
    return NextResponse.json(
      { error: "colaborador_id obrigatório" },
      { status: 400 }
    );
  }

  // Valida UUID
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(colaborador_id)) {
    return NextResponse.json(
      { error: "colaborador_id inválido" },
      { status: 400 }
    );
  }

  const rows = await sql`
    SELECT id::text, nome, status
    FROM colaboradores
    WHERE id = ${colaborador_id}::uuid
    LIMIT 1
  `;

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Colaborador não encontrado" },
      { status: 404 }
    );
  }

  const colab = rows[0];
  if (colab.status !== "ativo") {
    return NextResponse.json({ error: "Colaborador inativo" }, { status: 403 });
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + TRINTA_DIAS;

  const token = jwtSign({
    sub: String(colab.id),
    nome: String(colab.nome),
    iss: "lideradv",
    iat: now,
    exp,
  });

  return NextResponse.json({
    token,
    expires_at: new Date(exp * 1000).toISOString(),
    colaborador: {
      id: String(colab.id),
      nome: String(colab.nome),
    },
  });
}
