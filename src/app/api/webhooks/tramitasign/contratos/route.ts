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

interface WebhookSigner {
  id?: string;
  email?: string | null;
  all_documents_signed?: boolean;
  signature_link?: string | null;
}

interface WebhookDocument {
  signed_file_url?: string | null;
}

interface WebhookEnvelope {
  id?: number;
  status?: string;
  signers?: WebhookSigner[];
  documents?: WebhookDocument[];
}

// A API real do TramitaSign modela isso como envelope (POST /assinaturas),
// não "documento" isolado — eventos confirmados na doc oficial deles
// (schema SignatureSigner): `envelope.sent`, `envelope.signed` e
// `envelope.completed`, com o corpo de todo evento de envelope sendo o
// mesmo SignatureEnvelope de qualquer resposta do grupo /assinaturas
// (id, status, signers[], documents[]). O wrapper exato do payload
// (event_type solto vs dentro de "data" etc.) não está 100% documentado
// publicamente, então a extração abaixo tenta os formatos mais prováveis
// em vez de assumir só um.
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
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const eventType = String(payload.event_type ?? payload.event ?? "");

  const envelope: WebhookEnvelope =
    (payload.envelope as WebhookEnvelope | undefined) ??
    ((payload.data as { envelope?: WebhookEnvelope } | undefined)?.envelope as
      | WebhookEnvelope
      | undefined) ??
    // Formato achatado: o próprio payload já é o envelope (tem id + signers).
    (typeof payload.id === "number" && Array.isArray(payload.signers)
      ? (payload as unknown as WebhookEnvelope)
      : undefined) ??
    {};

  const envelopeTramitaId = envelope.id;
  if (typeof envelopeTramitaId !== "number") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      event: eventType,
      motivo: "payload sem envelope.id",
    });
  }

  const [nosso] = await sql`
    SELECT id::text, status FROM envelopes
    WHERE tramitasign_envelope_id = ${envelopeTramitaId}
  `;
  if (!nosso) {
    return NextResponse.json({
      ok: false,
      message: `Nenhum envelope com tramitasign_envelope_id '${envelopeTramitaId}'`,
    });
  }
  const envelopeId = nosso.id as string;

  // Atualiza cada assinante: link de assinatura assim que disponível
  // (POST /envio responde antes disso ficar pronto — é por isso que esse
  // webhook existe também pra esse caso, não só pra marcar "assinado") e
  // status quando ele já terminou de assinar.
  const signers = Array.isArray(envelope.signers) ? envelope.signers : [];
  for (const s of signers) {
    if (!s.id) continue;
    if (s.signature_link) {
      await sql`
        UPDATE envelope_assinantes
        SET tramitasign_link = ${s.signature_link}, tramitasign_erro = NULL
        WHERE envelope_id = ${envelopeId}::uuid AND tramitasign_signer_id = ${s.id}
      `;
    }
    if (s.all_documents_signed) {
      await sql`
        UPDATE envelope_assinantes
        SET status = 'assinado', assinado_em = COALESCE(assinado_em, now())
        WHERE envelope_id = ${envelopeId}::uuid AND tramitasign_signer_id = ${s.id}
      `;
    }
  }

  const finalizado =
    eventType === "envelope.completed" || envelope.status === "finalizado";

  if (finalizado && nosso.status !== "concluido") {
    await sql`
      UPDATE envelopes SET status = 'concluido', atualizado_em = now()
      WHERE id = ${envelopeId}::uuid
    `;
  }

  if (!finalizado) {
    return NextResponse.json({
      ok: true,
      envelope_id: envelopeId,
      event: eventType,
      finalizado: false,
    });
  }

  // Envelope concluído — se for um lead do PrevBot (contrato_id = nosso
  // envelope_id), converte e avisa o PrevBot de volta.
  const signedUrl =
    (envelope.documents ?? []).find((d) => d.signed_file_url)
      ?.signed_file_url ?? null;

  const updated = await sql`
    UPDATE crm_leads SET
      contrato_status      = 'assinado',
      contrato_url         = COALESCE(${signedUrl}, contrato_url),
      contrato_assinado_em = COALESCE(contrato_assinado_em, now()),
      updated_at           = now()
    WHERE contrato_id = ${envelopeId}
    RETURNING id::text, nome, telefone, contrato_url, prevbot_lead_id
  `;

  if (updated.length === 0) {
    return NextResponse.json({
      ok: true,
      envelope_id: envelopeId,
      event: eventType,
      finalizado: true,
    });
  }

  const lead = updated[0] as {
    id: string;
    nome: string;
    telefone: string;
    contrato_url: string | null;
    prevbot_lead_id: string | null;
  };

  const { clientId, processoId, documentoId } = await converterLeadAssinado(
    lead.id,
    signedUrl || lead.contrato_url
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
          contrato_id: envelopeId,
          document_id: envelopeId,
          prevbot_lead_id: lead.prevbot_lead_id,
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
    contrato_id: envelopeId,
    contrato_status: "assinado",
    client_id: clientId,
    processo_id: processoId,
    documento_id: documentoId,
  });
}
