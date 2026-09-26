import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import sql from "@/lib/db";
import { processarAtualizacaoEnvelope } from "@/lib/assinaturas-sync";

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
    SELECT id::text FROM envelopes
    WHERE tramitasign_envelope_id = ${envelopeTramitaId}
  `;
  if (!nosso) {
    return NextResponse.json({
      ok: false,
      message: `Nenhum envelope com tramitasign_envelope_id '${envelopeTramitaId}'`,
    });
  }
  const envelopeId = nosso.id as string;

  // Envelope pode ter mais de um documento (wizard permite selecionar
  // vários modelos) — pega TODOS os signed_file_url, não só o primeiro.
  const signedUrls = (envelope.documents ?? [])
    .map((d) => d.signed_file_url)
    .filter((u): u is string => !!u);
  // event_type é a fonte mais confiável pra desfechos — envelope.status
  // (quando vem no payload) serve de reforço/fallback.
  const remoteStatus =
    eventType === "envelope.completed"
      ? "finalizado"
      : eventType === "envelope.canceled"
        ? "cancelado"
        : eventType === "envelope.failed"
          ? "falhou"
          : (envelope.status ?? "");

  const { finalizado } = await processarAtualizacaoEnvelope({
    envelopeId,
    remoteStatus,
    signers: (envelope.signers ?? [])
      .filter((s): s is WebhookSigner & { id: string } => !!s.id)
      .map((s) => ({
        id: s.id,
        signatureLink: s.signature_link ?? null,
        allDocumentsSigned: !!s.all_documents_signed,
      })),
    signedUrls,
  });

  return NextResponse.json({
    ok: true,
    envelope_id: envelopeId,
    event: eventType,
    finalizado,
  });
}
