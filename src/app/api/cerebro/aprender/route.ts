import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { aprenderComResultado } from "@/lib/cerebroJuridico";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { processo_id } = await req.json();
    if (!processo_id)
      return NextResponse.json(
        { error: "processo_id obrigatório" },
        { status: 400 }
      );
    const ok = await aprenderComResultado(processo_id);
    return NextResponse.json({
      ok,
      msg: ok
        ? "Aprendizado registrado com sucesso"
        : "Nada a aprender (processo não concluído ou já processado)",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cerebro/aprender]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
