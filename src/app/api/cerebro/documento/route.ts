import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { analisarDocumento } from "@/lib/cerebroJuridico";
import { iaRateLimitExcedido } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (await iaRateLimitExcedido(session.login))
    return NextResponse.json(
      {
        error:
          "Limite de requisições de IA excedido. Tente novamente em 1 hora.",
      },
      { status: 429 }
    );

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
    console.error(
      "[cerebro/documento]",
      e instanceof Error ? e.message : String(e)
    );
    return NextResponse.json(
      { error: "Erro ao analisar documento. Tente novamente." },
      { status: 500 }
    );
  }
}
