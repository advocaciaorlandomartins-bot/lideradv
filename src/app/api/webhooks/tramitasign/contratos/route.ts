import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import sql from "@/lib/db";
import { converterLeadAssinado } from "@/lib/crm-contrato";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function verificarAssinatura(
  body: string,
  signature: string,
  secret: string
): boolean {
  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const actual = signature.replace(/^sha256=/, "");
    if (expected.length !== actual.length) return false;
    return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const secret = process.env.TRAMITASIGN_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook não configurado no servidor." },
      { status: 503 }
    );
  }

  const rawBody = await request.text();
  const sig = request.headers.get("x-webhook-signature") ?? "";
  if (!verificarAssinatura(rawBody, sig, secret)) {
    return NextResponse.json(
      { error: "Assinatura inválida" },
      { status: 401 }
    );
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const eventType = (payload.event_type ?? payload.event ?? "") as string;

  const isAssinado =
    eventType === "document.signed" ||
    eventType === "contract.signed" ||
    eventType === "signing.completed" ||
    (payload.status as string | undefined) === "signed" ||
    (payload.status as string | undefined) === "completed";

  if (!isAssinado) {
    return NextResponse.json({ ok: true, skipped: true, event: eventType });
  }

  const data = (payload.data ?? payload) as Record<string, unknown>;
  const contratoId = (data.document_id ??
    data.contract_id ??
    data.contrato_id ??
    data.id ??
    "") as string;
  const contratoUrlAssinado =
    ((data.signed_url ?? data.document_url ?? data.url ?? "") as string) ||
    null;

  if (!contratoId) {
    return NextResponse.json(
      { error: "document_id não encontrado no payload" },
      { status: 422 }
    );
  }

  const updated = await sql`
    UPDATE crm_leads SET
      contrato_status      = 'assinado',
      contrato_url         = COALESCE(${contratoUrlAssinado}, contrato_url),
      contrato_assinado_em = COALESCE(contrato_assinado_em, now()),
      updated_at           = now()
    WHERE contrato_id = ${String(contratoId)}
    RETURNING id::text, nome, telefone, contrato_url
  `;

  if (updated.length === 0) {
    return NextResponse.json(
      { ok: false, message: `Nenhum lead com contrato_id '${contratoId}'` },
      { status: 404 }
    );
  }

  const lead = updated[0] as {
    id: string;
    nome: string;
    telefone: string;
    contrato_url: string | null;
  };

  const { clientId, processoId, documentoId } = await converterLeadAssinado(
    lead.id,
    contratoUrlAssinado || lead.contrato_url
  );

  // Notifica PrevBot
  const prevbotCallbackUrl = process.env.PREVBOT_CALLBACK_URL;
  if (prevbotCallbackUrl) {
    try {
      await fetch(prevbotCallbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.CONTRATO_WEBHOOK_SECRET && {
            Authorization: `Bearer ${process.env.CONTRATO_WEBHOOK_SECRET}`,
          }),
        },
        body: JSON.stringify({
          contrato_id: contratoId,
          document_id: contratoId,
        }),
        signal: AbortSignal.timeout(8000),
      });
    } catch (err) {
      console.error("[TramitaSign/contratos] Falha ao notificar PrevBot:", err);
    }
  }

  return NextResponse.json({
    ok: true,
    lead_id: lead.id,
    nome: lead.nome,
    contrato_id: contratoId,
    contrato_status: "assinado",
    client_id: clientId,
    processo_id: processoId,
    documento_id: documentoId,
  });
}
