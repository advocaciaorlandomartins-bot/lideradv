import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { interpretarAndamento } from "@/lib/cerebroJuridico";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const { andamento_id, processo_id } = await req.json();
    if (!andamento_id || !processo_id)
      return NextResponse.json(
        { error: "andamento_id e processo_id obrigatórios" },
        { status: 400 }
      );
    const result = await interpretarAndamento(andamento_id, processo_id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cerebro/andamento]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
