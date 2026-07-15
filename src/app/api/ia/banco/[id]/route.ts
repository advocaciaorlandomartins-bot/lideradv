import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET — buscar petição completa (com texto)
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const [row] = await sql`
    SELECT
      id::text,
      area,
      tipo_peticao,
      titulo,
      texto,
      resumo,
      aprovada,
      vezes_usada,
      processo_id::text,
      cliente_id::text,
      created_at
    FROM ia_peticoes
    WHERE id = ${id}::uuid
      AND created_by = ${session.id}::uuid
    LIMIT 1
  `;

  if (!row)
    return NextResponse.json(
      { error: "Petição não encontrada." },
      { status: 404 }
    );

  return NextResponse.json(row);
}

// PATCH — atualizar texto e/ou título de uma petição
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  const body = await request.json().catch(() => null);

  if (!body?.texto && !body?.titulo && body?.aprovada === undefined)
    return NextResponse.json(
      { error: "Informe texto, titulo ou aprovada para atualizar." },
      { status: 400 }
    );

  const resumo = body.texto
    ? body.texto
        .replace(/\n+/g, " ")
        .trim()
        .slice(0, 300)
        .concat(body.texto.length > 300 ? "…" : "")
    : undefined;

  if (body.texto !== undefined && body.titulo !== undefined) {
    await sql`
      UPDATE ia_peticoes
      SET texto = ${body.texto}, titulo = ${body.titulo}, resumo = ${resumo ?? null}
      WHERE id = ${id}::uuid AND created_by = ${session.id}::uuid
    `;
  } else if (body.texto !== undefined) {
    await sql`
      UPDATE ia_peticoes
      SET texto = ${body.texto}, resumo = ${resumo ?? null}
      WHERE id = ${id}::uuid AND created_by = ${session.id}::uuid
    `;
  } else if (body.titulo !== undefined) {
    await sql`
      UPDATE ia_peticoes SET titulo = ${body.titulo}
      WHERE id = ${id}::uuid AND created_by = ${session.id}::uuid
    `;
  }

  if (body.aprovada !== undefined) {
    await sql`
      UPDATE ia_peticoes SET aprovada = ${body.aprovada}
      WHERE id = ${id}::uuid AND created_by = ${session.id}::uuid
    `;
  }

  return NextResponse.json({ ok: true });
}

// DELETE — remover petição específica
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await params;
  if (!UUID_RE.test(id))
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });

  await sql`
    DELETE FROM ia_peticoes
    WHERE id = ${id}::uuid AND created_by = ${session.id}::uuid
  `;
  return NextResponse.json({ ok: true });
}
