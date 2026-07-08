import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getMeuFinanceiroInitial,
  criarLancamentoPessoal,
} from "@/lib/meu-financeiro-db";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await getMeuFinanceiroInitial(session.id);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[meu-financeiro/lancamentos GET]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

    if (!tipo || !categoria || !descricao || !valor || !data || !status) {
      return NextResponse.json(
        { error: "Campos obrigatórios ausentes" },
        { status: 400 }
      );
    }

    const parsed = parseFloat(String(valor));
    if (isNaN(parsed) || parsed <= 0) {
      return NextResponse.json({ error: "Valor inválido" }, { status: 400 });
    }

    const novo = await criarLancamentoPessoal(session.id, {
      tipo,
      categoria: String(categoria).slice(0, 100),
      descricao: String(descricao).slice(0, 500),
      valor: parsed,
      data: String(data).slice(0, 10),
      status,
      recorrente: Boolean(recorrente),
      periodicidade: recorrente ? (periodicidade ?? null) : null,
    });

    return NextResponse.json(novo, { status: 201 });
  } catch (err) {
    console.error("[meu-financeiro/lancamentos POST]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
