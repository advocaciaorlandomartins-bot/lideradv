import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  const [teste] = await sql`
    SELECT * FROM testes_comportamentais
    WHERE id = ${id}::uuid AND created_by = ${session.id}::uuid
  `;

  if (!teste) {
    return NextResponse.json(
      { error: "Teste não encontrado." },
      { status: 404 }
    );
  }

  return NextResponse.json({ teste });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  await sql`DELETE FROM testes_comportamentais WHERE id = ${id}::uuid AND created_by = ${session.id}::uuid`;

  return NextResponse.json({ ok: true });
}
