import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getBibliotecaItemById,
  aprovarItemBiblioteca,
} from "@/lib/biblioteca-juridica-db";

export const dynamic = "force-dynamic";

// Aprovação grava de verdade em precedentes/ia_peticoes (afeta toda petição
// e análise futura do mesmo tipo de benefício) — mesmo padrão de admin-only
// direto por categoria já usado em PATCH /api/ia/banco (aprovar petição).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.categoria !== "Administrador(a)") {
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
      { error: "Este item já foi aprovado." },
      { status: 400 }
    );

  const body = await request.json().catch(() => null);
  const categoria = body?.categoria;
  if (categoria !== "precedente" && categoria !== "modelo_peticao") {
    return NextResponse.json(
      { error: "categoria deve ser 'precedente' ou 'modelo_peticao'." },
      { status: 400 }
    );
  }

  let resultado: { ok: boolean; error?: string };
  if (categoria === "precedente") {
    const tribunal = String(body?.tribunal ?? "").trim();
    const identificacao = String(body?.identificacao ?? "").trim();
    const tese = String(body?.tese ?? "").trim();
    const beneficiosAplicaveis: string[] = Array.isArray(
      body?.beneficiosAplicaveis
    )
      ? body.beneficiosAplicaveis.map((b: unknown) => String(b).trim())
      : [];
    if (
      !tribunal ||
      !identificacao ||
      !tese ||
      beneficiosAplicaveis.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Pra aprovar como precedente: tribunal, identificação, tese e ao menos um benefício são obrigatórios.",
        },
        { status: 400 }
      );
    }
    resultado = await aprovarItemBiblioteca(id, session.id, {
      categoria: "precedente",
      tribunal,
      identificacao,
      tese,
      beneficiosAplicaveis,
      observacao: body?.observacao ? String(body.observacao).trim() : null,
    });
  } else {
    const area = String(body?.area ?? "").trim();
    const tipoPeticao = String(body?.tipoPeticao ?? "").trim();
    const titulo = String(body?.titulo ?? item.nome).trim();
    const texto = String(body?.texto ?? "").trim();
    if (!area || !tipoPeticao || !texto) {
      return NextResponse.json(
        {
          error:
            "Pra aprovar como modelo de petição: área, tipo de peça e o texto extraído são obrigatórios.",
        },
        { status: 400 }
      );
    }
    resultado = await aprovarItemBiblioteca(id, session.id, {
      categoria: "modelo_peticao",
      area,
      tipoPeticao,
      titulo,
      texto,
      resumo: body?.resumo ? String(body.resumo).trim() : null,
    });
  }

  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error ?? "Erro ao aprovar." },
      { status: 400 }
    );
  }

  const atualizado = await getBibliotecaItemById(id);
  return NextResponse.json({ item: atualizado });
}
