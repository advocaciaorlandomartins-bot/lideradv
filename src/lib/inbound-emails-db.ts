import sql from "./db";

export interface InboundEmailAddress {
  id: string;
  client_id: string;
  address: string;
  is_active: boolean;
  created_at: string;
}

export interface InboundEmail {
  id: string;
  client_id: string;
  address_id: string | null;
  from_address: string;
  from_name: string | null;
  to_address: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  attachments: InboundAttachment[];
  ai_summary: string | null;
  lida: boolean;
  received_at: string;
}

export interface InboundAttachment {
  filename: string;
  content_type: string;
  size: number;
  url?: string;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

export async function setupInboundEmailTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS inbound_email_addresses (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
      address     TEXT UNIQUE NOT NULL,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_at  TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_iea_client_id
      ON inbound_email_addresses(client_id)
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS inbound_emails (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      address_id   UUID REFERENCES inbound_email_addresses(id) ON DELETE SET NULL,
      client_id    UUID REFERENCES clients(id) ON DELETE SET NULL,
      from_address TEXT NOT NULL,
      from_name    TEXT,
      to_address   TEXT NOT NULL,
      subject      TEXT,
      body_text    TEXT,
      body_html    TEXT,
      attachments  JSONB NOT NULL DEFAULT '[]',
      lida         BOOLEAN NOT NULL DEFAULT false,
      received_at  TIMESTAMPTZ DEFAULT now(),
      created_at   TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_ie_client_id
      ON inbound_emails(client_id)
  `;
  // Migration: add ai_summary column if not exists (idempotent)
  await sql`
    ALTER TABLE inbound_emails
      ADD COLUMN IF NOT EXISTS ai_summary TEXT
  `;
}

// ── Address helpers ────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)[0]
    .replace(/[^a-z0-9]/g, "");
}

const DOMAIN = process.env.INBOUND_EMAIL_DOMAIN ?? "timails.org";

export async function getAddressByClientId(
  clientId: string
): Promise<InboundEmailAddress | null> {
  const rows = await sql`
    SELECT id::text, client_id::text, address, is_active,
           to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS created_at
    FROM inbound_email_addresses
    WHERE client_id = ${clientId}::uuid AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return rows[0] as InboundEmailAddress;
}

export async function getAddressByEmail(
  address: string
): Promise<InboundEmailAddress | null> {
  const rows = await sql`
    SELECT id::text, client_id::text, address, is_active,
           created_at
    FROM inbound_email_addresses
    WHERE address = ${address} AND is_active = true
    LIMIT 1
  `;
  return (rows[0] as InboundEmailAddress) ?? null;
}

export async function createAddressForClient(
  clientId: string,
  clientName: string
): Promise<InboundEmailAddress> {
  // Ensure tables exist on first use
  await setupInboundEmailTables();

  const base = slugify(clientName);
  const year = new Date().getFullYear();
  const slug = `${base}${year}`;

  // Find unique address
  let address = `${slug}@${DOMAIN}`;
  const existing = await sql`
    SELECT address FROM inbound_email_addresses
    WHERE address LIKE ${slug + "%@" + DOMAIN}
  `;
  if (existing.length > 0) {
    const taken = new Set(
      existing.map((r) => (r as { address: string }).address)
    );
    const suffix = "abcdefghijklmnopqrstuvwxyz";
    let found = false;
    for (const ch of suffix) {
      const candidate = `${slug}${ch}@${DOMAIN}`;
      if (!taken.has(candidate)) {
        address = candidate;
        found = true;
        break;
      }
    }
    if (!found) {
      // last resort: numeric suffix
      address = `${slug}${Date.now()}@${DOMAIN}`;
    }
  }

  const rows = await sql`
    INSERT INTO inbound_email_addresses (client_id, address)
    VALUES (${clientId}::uuid, ${address})
    RETURNING
      id::text, client_id::text, address, is_active,
      to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS created_at
  `;
  return rows[0] as InboundEmailAddress;
}

// ── Emails ────────────────────────────────────────────────────────────────────

export async function getEmailsByClientId(
  clientId: string
): Promise<InboundEmail[]> {
  const rows = await sql`
    SELECT
      id::text,
      address_id::text,
      client_id::text,
      from_address,
      from_name,
      to_address,
      subject,
      body_text,
      body_html,
      attachments,
      ai_summary,
      lida,
      to_char(received_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS received_at
    FROM inbound_emails
    WHERE client_id = ${clientId}::uuid
    ORDER BY received_at DESC
    LIMIT 100
  `;
  return rows.map((r) => ({
    ...r,
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
  })) as InboundEmail[];
}

export async function saveInboundEmail(data: {
  addressId: string | null;
  clientId: string;
  fromAddress: string;
  fromName: string | null;
  toAddress: string;
  subject: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: InboundAttachment[];
  aiSummary?: string | null;
}): Promise<string> {
  const rows = data.addressId
    ? await sql`
        INSERT INTO inbound_emails
          (address_id, client_id, from_address, from_name, to_address,
           subject, body_text, body_html, attachments, ai_summary)
        VALUES
          (${data.addressId}::uuid, ${data.clientId}::uuid,
           ${data.fromAddress}, ${data.fromName}, ${data.toAddress},
           ${data.subject}, ${data.bodyText}, ${data.bodyHtml},
           ${JSON.stringify(data.attachments)}, ${data.aiSummary ?? null})
        RETURNING id::text
      `
    : await sql`
        INSERT INTO inbound_emails
          (client_id, from_address, from_name, to_address,
           subject, body_text, body_html, attachments, ai_summary)
        VALUES
          (${data.clientId}::uuid,
           ${data.fromAddress}, ${data.fromName}, ${data.toAddress},
           ${data.subject}, ${data.bodyText}, ${data.bodyHtml},
           ${JSON.stringify(data.attachments)}, ${data.aiSummary ?? null})
        RETURNING id::text
      `;
  return rows[0].id as string;
}

export async function markEmailAsRead(emailId: string): Promise<void> {
  await sql`
    UPDATE inbound_emails SET lida = true
    WHERE id = ${emailId}::uuid
  `;
}

export interface RecentEmailWithClient extends InboundEmail {
  client_name: string;
}

export async function getAllRecentEmails(
  limit = 30
): Promise<RecentEmailWithClient[]> {
  const rows = await sql`
    SELECT
      ie.id::text,
      ie.address_id::text,
      ie.client_id::text,
      ie.from_address,
      ie.from_name,
      ie.to_address,
      ie.subject,
      ie.body_text,
      ie.body_html,
      ie.attachments,
      ie.ai_summary,
      ie.lida,
      to_char(ie.received_at AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') AS received_at,
      c.name AS client_name
    FROM inbound_emails ie
    LEFT JOIN clients c ON c.id = ie.client_id
    ORDER BY ie.received_at DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    ...r,
    attachments: Array.isArray(r.attachments) ? r.attachments : [],
  })) as RecentEmailWithClient[];
}

export async function countUnreadEmails(): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*) AS total FROM inbound_emails WHERE lida = false
  `;
  return Number(rows[0]?.total ?? 0);
}
