import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { analisarDocumento } from "@/lib/cerebroJuridico";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  try {
    const { documento_id, processo_id } = await req.json();
    if (
      !documento_id ||
      !processo_id ||
      !UUID_RE.test(documento_id) ||
      !UUID_RE.test(processo_id)
    )
      return NextResponse.json(
        {
          error:
            "documento_id e processo_id obrigatórios e devem ser UUIDs válidos",
        },
        { status: 400 }
      );
    const analise = await analisarDocumento(documento_id, processo_id);
    return NextResponse.json({ ok: true, analise });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cerebro/documento]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
