import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// GET — buscar petições aprovadas por area/tipo
export async function GET(request: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const area = searchParams.get("area");
  const tipo = searchParams.get("tipo");
  const limit = Math.min(Number(searchParams.get("limit") ?? "5"), 10);

  const rows = await sql`
    SELECT id::text, area, tipo_peticao, titulo, resumo, vezes_usada, created_at
    FROM ia_peticoes
    WHERE aprovada = TRUE
      AND (${area}::text IS NULL OR area = ${area})
      AND (${tipo}::text IS NULL OR tipo_peticao ILIKE ${"%" + (tipo ?? "") + "%"})
    ORDER BY vezes_usada DESC, created_at DESC
    LIMIT ${limit}
  `;

  return NextResponse.json(rows);
}

// POST — salvar petição no banco
export async function POST(request: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.area || !body?.tipoPeticao || !body?.texto)
    return NextResponse.json(
      { error: "area, tipoPeticao e texto são obrigatórios." },
      { status: 400 }
    );

  // Gera resumo automático (primeiros 300 chars)
  const resumo = body.texto
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 300)
    .concat(body.texto.length > 300 ? "…" : "");

  const titulo =
    body.titulo ||
    `${body.tipoPeticao} — ${new Date().toLocaleDateString("pt-BR")}`;

  const [row] = await sql`
    INSERT INTO ia_peticoes (area, tipo_peticao, titulo, texto, resumo, aprovada)
    VALUES (${body.area}, ${body.tipoPeticao}, ${titulo}, ${body.texto}, ${resumo}, FALSE)
    RETURNING id::text, titulo
  `;

  return NextResponse.json({ id: row.id, titulo: row.titulo });
}

// PATCH — aprovar petição (torna-a referência)
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.id)
    return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  await sql`
    UPDATE ia_peticoes SET aprovada = TRUE WHERE id = ${body.id}::uuid
  `;

  return NextResponse.json({ ok: true });
}
