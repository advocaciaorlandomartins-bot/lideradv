import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { analisarDocumentoCliente } from "@/lib/cliente-documento-auto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authOk(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const expected = process.env.ADMIN_BACKFILL_SECRET;
  if (!expected || !token) return false;
  try {
    const a = Buffer.from(token);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Uso único/manual (não é um fluxo normal do app): reprocessa um documento
 * já anexado no cliente pra extrair os CIDs no formato novo (lista, não
 * cid_principal único) — mesma função que o botão "Reanalisar" da aba
 * Documentos chama, só que protegida por secret de admin em vez de
 * sessão, pra rodar em lote via script sem precisar clicar em cada
 * cliente. Um documento por chamada, de propósito — mantém cada request
 * bem abaixo dos 60s de limite da rota mesmo chamando vários em sequência.
 */
export async function POST(req: NextRequest) {
  if (!authOk(req)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: { documento_id?: string; cliente_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const { documento_id, cliente_id } = body;
  if (
    !documento_id ||
    !cliente_id ||
    !UUID_RE.test(documento_id) ||
    !UUID_RE.test(cliente_id)
  ) {
    return NextResponse.json(
      { error: "documento_id e cliente_id obrigatórios e devem ser UUIDs." },
      { status: 400 }
    );
  }

  try {
    const resultado = await analisarDocumentoCliente(documento_id, cliente_id);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (err) {
    console.error("[admin/backfill-cids]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro interno." },
      { status: 500 }
    );
  }
}
