import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import {
  listarBibliotecaJuridica,
  excluirItemBiblioteca,
  type BibliotecaCategoria,
  type BibliotecaStatus,
} from "@/lib/biblioteca-juridica-db";

export const dynamic = "force-dynamic";

const STATUS_VALIDOS = new Set([
  "processando",
  "pendente_revisao",
  "aprovado",
  "rejeitado",
  "erro",
]);
const CATEGORIAS_VALIDAS = new Set(["modelo_peticao", "precedente", "outro"]);

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !hasPermission(session, "biblioteca_juridica", "ver")) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const categoriaParam = searchParams.get("categoria");
  const busca = searchParams.get("busca") ?? undefined;

  const itens = await listarBibliotecaJuridica({
    status:
      statusParam && STATUS_VALIDOS.has(statusParam)
        ? (statusParam as BibliotecaStatus)
        : undefined,
    categoria:
      categoriaParam && CATEGORIAS_VALIDAS.has(categoriaParam)
        ? (categoriaParam as BibliotecaCategoria)
        : undefined,
    busca,
  });

  return NextResponse.json({ itens });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.categoria !== "Administrador(a)") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  await excluirItemBiblioteca(id);
  return NextResponse.json({ ok: true });
}
