import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { analisarDocumento } from "@/lib/cerebroJuridico";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import { podeAcessarProcesso } from "@/lib/acesso";
import sql from "@/lib/db";

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
    // Sem isso, qualquer usuário logado obtinha do modelo o conteúdo de
    // QUALQUER documento arbitrário (a IA lê e devolve o texto) bastando
    // combinar um processo_id acessível com um documento_id de outro caso.
    if (!(await podeAcessarProcesso(session, processo_id)))
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    const vinculado = await sql`
      SELECT 1 FROM documentos d
      WHERE d.id = ${documento_id}::uuid
        AND (
          (d.entity_type = 'processo' AND d.entity_id = ${processo_id}::uuid)
          OR (d.entity_type = 'cliente' AND EXISTS (
            SELECT 1 FROM processos p
            WHERE p.id = ${processo_id}::uuid AND p.client_id = d.entity_id
          ))
        )
      LIMIT 1
    `;
    if (vinculado.length === 0)
      return NextResponse.json(
        { error: "Documento não pertence a este processo." },
        { status: 403 }
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
