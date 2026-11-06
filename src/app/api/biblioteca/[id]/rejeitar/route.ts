import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import {
  getBibliotecaItemById,
  rejeitarItemBiblioteca,
} from "@/lib/biblioteca-juridica-db";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !hasPermission(session, "biblioteca_juridica", "editar")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const item = await getBibliotecaItemById(id);
  if (!item)
    return NextResponse.json(
      { error: "Item não encontrado." },
      { status: 404 }
    );
  if (item.status === "aprovado")
    return NextResponse.json(
      { error: "Este item já foi aprovado — não dá pra rejeitar." },
      { status: 400 }
    );

  await rejeitarItemBiblioteca(id, session.id);
  const atualizado = await getBibliotecaItemById(id);
  return NextResponse.json({ item: atualizado });
}
