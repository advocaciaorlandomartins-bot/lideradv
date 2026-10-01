import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { analisarDocumentoCliente } from "@/lib/cliente-documento-auto";
import { iaRateLimitExcedido } from "@/lib/rate-limit";
import { podeAcessarCliente } from "@/lib/acesso";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reanalisa um documento já anexado direto no cliente (sem processo) — útil
 * pra reprocessar documento antigo com um prompt de extração novo (ex:
 * passou a extrair todos os CIDs, não só um) sem precisar reenviar o
 * arquivo. Mesmo padrão de /api/cerebro/documento (processo), só que pro
 * caso entity_type='cliente'.
 */
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

  try {
    const { documento_id, cliente_id } = await req.json();
    if (
      !documento_id ||
      !cliente_id ||
      !UUID_RE.test(documento_id) ||
      !UUID_RE.test(cliente_id)
    )
      return NextResponse.json(
        {
          error:
            "documento_id e cliente_id obrigatórios e devem ser UUIDs válidos",
        },
        { status: 400 }
      );
    if (!(await podeAcessarCliente(session, cliente_id)))
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

    const vinculado = await sql`
      SELECT 1 FROM documentos
      WHERE id = ${documento_id}::uuid
        AND entity_type = 'cliente' AND entity_id = ${cliente_id}::uuid
      LIMIT 1
    `;
    if (vinculado.length === 0)
      return NextResponse.json(
        { error: "Documento não pertence a este cliente." },
        { status: 403 }
      );

    const resultado = await analisarDocumentoCliente(documento_id, cliente_id);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e: unknown) {
    console.error(
      "[cerebro/documento-cliente]",
      e instanceof Error ? e.message : String(e)
    );
    return NextResponse.json(
      { error: "Erro ao analisar documento. Tente novamente." },
      { status: 500 }
    );
  }
}
