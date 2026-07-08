import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  atualizarLancamentoPessoal,
  deletarLancamentoPessoal,
} from "@/lib/meu-financeiro-db";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const body = await req.json();
    const {
      tipo,
      categoria,
      descricao,
      valor,
      data,
      status,
      recorrente,
      periodicidade,
    } = body;

    const parsed = parseFloat(String(valor));
    if (isNaN(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const atualizado = await atualizarLancamentoPessoal(id, session.id, {
      tipo,
      categoria: String(categoria).slice(0, 100),
      descricao: String(descricao).slice(0, 500),
      valor: parsed,
      data: String(data).slice(0, 10),
      status,
      recorrente: Boolean(recorrente),
      periodicidade: recorrente ? (periodicidade ?? null) : null,
    });

    if (!atualizado) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }

    return NextResponse.json(atualizado);
  } catch (err) {
    console.error("[meu-financeiro/lancamentos PUT]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "ID inválido" }, { status: 400 });

  try {
    const ok = await deletarLancamentoPessoal(id, session.id);
    if (!ok)
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[meu-financeiro/lancamentos DELETE]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
