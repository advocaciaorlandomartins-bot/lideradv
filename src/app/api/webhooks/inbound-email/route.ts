import { NextResponse } from "next/server";
import { getAddressByEmail, saveInboundEmail } from "@/lib/inbound-emails-db";
import type { InboundAttachment } from "@/lib/inbound-emails-db";

export const dynamic = "force-dynamic";

// ── Normaliza payload de diferentes provedores ─────────────────────────────────
// Suporta: Mailgun, SendGrid Inbound Parse, Postmark

interface NormalizedEmail {
  toAddress: string;
  fromAddress: string;
  fromName: string | null;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: InboundAttachment[];
}

function parseMailgun(body: Record<string, unknown>): NormalizedEmail | null {
  const recipient = (body.recipient ?? body.To ?? body.to) as
    | string
    | undefined;
  const sender = (body.sender ?? body.From ?? body.from) as string | undefined;
  if (!recipient || !sender) return null;

  const fromMatch = sender.match(/^(?:"?([^"<]*)"?\s*<)?([^>]+)>?$/);
  return {
    toAddress: recipient.toLowerCase(),
    fromAddress: (fromMatch?.[2] ?? sender).toLowerCase(),
    fromName: fromMatch?.[1]?.trim() || null,
    subject: (body.subject ?? body.Subject) as string | null,
    bodyText: (body["body-plain"] ?? body.text) as string | null,
    bodyHtml: (body["body-html"] ?? body.html) as string | null,
    attachments: [],
  };
}

function parseSendGrid(body: Record<string, unknown>): NormalizedEmail | null {
  const to = body.to as string | undefined;
  const from = body.from as string | undefined;
  if (!to || !from) return null;

  const fromMatch = from.match(/^(?:"?([^"<]*)"?\s*<)?([^>]+)>?$/);
  return {
    toAddress: to.toLowerCase(),
    fromAddress: (fromMatch?.[2] ?? from).toLowerCase(),
    fromName: fromMatch?.[1]?.trim() || null,
    subject: body.subject as string | null,
    bodyText: body.text as string | null,
    bodyHtml: body.html as string | null,
    attachments: [],
  };
}

function parsePostmark(body: Record<string, unknown>): NormalizedEmail | null {
  const to = (body.To ?? body.OriginalRecipient) as string | undefined;
  const from = body.From as string | undefined;
  if (!to || !from) return null;

  const toAddress =
    to.match(/<([^>]+)>/)?.[1]?.toLowerCase() ?? to.toLowerCase();
  const fromMatch = from.match(/^(?:"?([^"<]*)"?\s*<)?([^>]+)>?$/);
  const attachmentsList = (body.Attachments as unknown[]) ?? [];

  return {
    toAddress,
    fromAddress: (fromMatch?.[2] ?? from).toLowerCase(),
    fromName: fromMatch?.[1]?.trim() || null,
    subject: body.Subject as string | null,
    bodyText: body.TextBody as string | null,
    bodyHtml: body.HtmlBody as string | null,
    attachments: attachmentsList.map((a) => {
      const att = a as Record<string, unknown>;
      return {
        filename: att.Name as string,
        content_type: att.ContentType as string,
        size: (att.ContentLength as number) ?? 0,
      } satisfies InboundAttachment;
    }),
  };
}

function normalize(body: Record<string, unknown>): NormalizedEmail | null {
  // Postmark: tem campo "MessageID"
  if (body.MessageID) return parsePostmark(body);
  // SendGrid: tem campo "envelope"
  if (body.envelope || (body.to && body.from && !body.sender))
    return parseSendGrid(body);
  // Mailgun (default)
  return parseMailgun(body);
}

// ── Webhook handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = await request.json();
  } else {
    // Mailgun envia como form-urlencoded
    const text = await request.text();
    const params = new URLSearchParams(text);
    body = Object.fromEntries(params.entries());
  }

  const email = normalize(body);
  if (!email) {
    return NextResponse.json(
      { error: "Payload não reconhecido." },
      { status: 400 }
    );
  }

  // Identificar cliente pelo endereço destinatário
  const addr = await getAddressByEmail(email.toAddress);
  if (!addr) {
    // Endereço não cadastrado no sistema — aceitar mas não salvar como cliente
    return NextResponse.json({ status: "ignored", reason: "unknown_address" });
  }

  await saveInboundEmail({
    addressId: addr.id,
    clientId: addr.client_id,
    fromAddress: email.fromAddress,
    fromName: email.fromName,
    toAddress: email.toAddress,
    subject: email.subject,
    bodyText: email.bodyText,
    bodyHtml: email.bodyHtml,
    attachments: email.attachments,
  });

  return NextResponse.json({ status: "ok" });
}
