import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  obterConversa,
  listarMensagens,
  excluirConversa,
} from "@/lib/iris-conversas-db";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const conversa = await obterConversa(session.id, id);
  if (!conversa)
    return NextResponse.json(
      { error: "Conversa não encontrada." },
      { status: 404 }
    );

  const mensagens = await listarMensagens(id);
  return NextResponse.json({ conversa, mensagens });
}

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

  const ok = await excluirConversa(session.id, id);
  if (!ok)
    return NextResponse.json(
      { error: "Conversa não encontrada." },
      { status: 404 }
    );

  return NextResponse.json({ ok: true });
}
