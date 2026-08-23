import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import { podeAcessarProcesso } from "@/lib/acesso";
import { aprenderComResultado } from "@/lib/cerebroJuridico";

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
    const { processo_id } = await req.json();
    if (!processo_id || !UUID_RE.test(processo_id))
      return NextResponse.json(
        { error: "processo_id obrigatório e deve ser UUID válido" },
        { status: 400 }
      );
    if (!(await podeAcessarProcesso(session, processo_id)))
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    const ok = await aprenderComResultado(processo_id);
    return NextResponse.json({
      ok,
      msg: ok
        ? "Aprendizado registrado com sucesso"
        : "Nada a aprender (processo não concluído ou já processado)",
    });
  } catch (e: unknown) {
    console.error(
      "[cerebro/aprender]",
      e instanceof Error ? e.message : String(e)
    );
    return NextResponse.json(
      { error: "Erro ao registrar aprendizado. Tente novamente." },
      { status: 500 }
    );
  }
}
