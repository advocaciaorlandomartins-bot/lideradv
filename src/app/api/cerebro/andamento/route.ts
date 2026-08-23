import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import { podeAcessarProcesso } from "@/lib/acesso";
import { interpretarAndamento } from "@/lib/cerebroJuridico";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.id || !hasPermission(session, "processos", "ver"))
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  if (await iaRateLimitExcedido(session.login)) {
    return NextResponse.json(
      {
        error:
          "Limite de requisições de IA excedido. Tente novamente em 1 hora.",
      },
      { status: 429 }
    );
  }

  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  try {
    const { andamento_id, processo_id } = await req.json();
    if (
      !andamento_id ||
      !processo_id ||
      !UUID_RE.test(andamento_id) ||
      !UUID_RE.test(processo_id)
    )
      return NextResponse.json(
        {
          error:
            "andamento_id e processo_id obrigatórios e devem ser UUIDs válidos",
        },
        { status: 400 }
      );
    // "processos:ver" sozinho não restringe ao processo do próprio
    // responsável — sem isso qualquer usuário lia o diagnóstico de IA de
    // qualquer processo do escritório trocando o UUID.
    if (!(await podeAcessarProcesso(session, processo_id)))
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    const result = await interpretarAndamento(andamento_id, processo_id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    console.error(
      "[cerebro/andamento]",
      e instanceof Error ? e.message : String(e)
    );
    return NextResponse.json(
      { error: "Erro ao interpretar andamento. Tente novamente." },
      { status: 500 }
    );
  }
}
