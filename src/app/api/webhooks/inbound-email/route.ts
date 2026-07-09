import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  getAddressByEmail,
  saveInboundEmail,
  setupInboundEmailTables,
} from "@/lib/inbound-emails-db";
import type { InboundAttachment } from "@/lib/inbound-emails-db";
import { getEscritorioConfig } from "@/lib/escritorio-db";
import { resumirEmail } from "@/lib/ai";
import { notificarEmailRecebido } from "@/lib/email";
import sql from "@/lib/db";

function verificarWebhookAuth(request: Request): boolean {
  const secret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET;
  // Se a variável não estiver configurada, bloqueia por segurança
  if (!secret) return false;
  const header =
    request.headers.get("x-webhook-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer /, "") ??
    "";
  if (!header) return false;
  try {
    const a = Buffer.from(header);
    const b = Buffer.from(secret);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const dynamic = "force-dynamic";

// ── Normaliza payload de diferentes provedores ─────────────────────────────────

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
  if (body.MessageID) return parsePostmark(body);
  if (body.envelope || (body.to && body.from && !body.sender))
    return parseSendGrid(body);
  return parseMailgun(body);
}

// ── Busca nome do cliente pelo address_id ─────────────────────────────────────

async function getClientName(clientId: string): Promise<string> {
  try {
    const rows = await sql`
      SELECT name FROM clients WHERE id = ${clientId}::uuid LIMIT 1
    `;
    return (rows[0]?.name as string) ?? "Cliente";
  } catch {
    return "Cliente";
  }
}

// ── Webhook handler ───────────────────────────────────────────────────────────

export async function POST(request: Request) {
  if (!verificarWebhookAuth(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: Record<string, unknown>;

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = await request.json();
  } else {
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

  const addr = await getAddressByEmail(email.toAddress);
  if (!addr) {
    return NextResponse.json({ status: "ignored", reason: "unknown_address" });
  }

  // Garante que a coluna ai_summary existe (migration idempotente)
  await setupInboundEmailTables().catch(() => null);

  // ── Gera resumo IA e salva em paralelo ────────────────────────────────────
  const [aiSummary, clientName, config] = await Promise.all([
    resumirEmail(email.subject, email.bodyText).catch(() => null),
    getClientName(addr.client_id),
    getEscritorioConfig().catch(() => null),
  ]);

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
    aiSummary,
  });

  // ── Notificação por e-mail (não bloqueia a resposta) ──────────────────────
  if (config?.email) {
    notificarEmailRecebido({
      para: config.email,
      cliente: clientName,
      clienteId: addr.client_id,
      de: email.fromAddress,
      deNome: email.fromName,
      assunto: email.subject,
      resumoIA: aiSummary,
      corpo: email.bodyText,
    }).catch((err) => console.error("[webhook] notificarEmailRecebido:", err));
  }

  return NextResponse.json({ status: "ok" });
}
