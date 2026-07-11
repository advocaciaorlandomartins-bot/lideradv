import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

// GET — buscar petições por processo, cliente ou área
export async function GET(request: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const processoId = searchParams.get("processoId");
  const clienteId = searchParams.get("clienteId");
  const area = searchParams.get("area");
  const apenasAprovadas = searchParams.get("aprovadas") === "1";
  const limit = Math.min(Number(searchParams.get("limit") ?? "20"), 50);

  const rows = await sql`
    SELECT
      id::text,
      area,
      tipo_peticao,
      titulo,
      resumo,
      aprovada,
      vezes_usada,
      processo_id::text,
      cliente_id::text,
      created_at
    FROM ia_peticoes
    WHERE (${processoId}::text IS NULL OR processo_id = ${processoId}::uuid)
      AND (${clienteId}::text IS NULL OR cliente_id = ${clienteId}::uuid)
      AND (${area}::text IS NULL OR area = ${area})
      AND (NOT ${apenasAprovadas} OR aprovada = TRUE)
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return NextResponse.json(rows);
}

// POST — salvar petição vinculada ao processo/cliente
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

  const resumo = body.texto
    .replace(/\n+/g, " ")
    .trim()
    .slice(0, 300)
    .concat(body.texto.length > 300 ? "…" : "");

  const titulo =
    body.titulo ||
    `${body.tipoPeticao} — ${new Date().toLocaleDateString("pt-BR")}`;

  const [row] = await sql`
    INSERT INTO ia_peticoes
      (area, tipo_peticao, titulo, texto, resumo, aprovada, processo_id, cliente_id)
    VALUES (
      ${body.area},
      ${body.tipoPeticao},
      ${titulo},
      ${body.texto},
      ${resumo},
      FALSE,
      ${body.processoId ?? null}::uuid,
      ${body.clienteId ?? null}::uuid
    )
    RETURNING id::text, titulo, created_at
  `;

  return NextResponse.json({ id: row.id, titulo: row.titulo });
}

// PATCH — aprovar petição (torna-a referência para o banco global) — apenas admin
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.categoria !== "Administrador(a)")
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.id)
    return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  await sql`
    UPDATE ia_peticoes SET aprovada = TRUE WHERE id = ${body.id}::uuid
  `;

  return NextResponse.json({ ok: true });
}

// DELETE — remover petição — apenas admin
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.categoria !== "Administrador(a)")
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  await sql`DELETE FROM ia_peticoes WHERE id = ${id}::uuid`;
  return NextResponse.json({ ok: true });
}
