import { google } from "googleapis";
import sql from "./db";

// ── OAuth2 client factory ──────────────────────────────────────────────────────

export function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ── Token persistence ──────────────────────────────────────────────────────────

export async function getStoredToken(userId: string) {
  const rows = await sql`
    SELECT access_token, refresh_token, token_expiry, google_email
    FROM google_tokens
    WHERE usuario_id = ${userId}::uuid
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function saveToken(
  userId: string,
  accessToken: string,
  refreshToken: string | null | undefined,
  expiryDate: number | null | undefined,
  email: string | null
) {
  const expiry = expiryDate ? new Date(expiryDate).toISOString() : null;
  await sql`
    INSERT INTO google_tokens (usuario_id, access_token, refresh_token, token_expiry, google_email, updated_at)
    VALUES (${userId}::uuid, ${accessToken}, ${refreshToken ?? null}, ${expiry}, ${email}, now())
    ON CONFLICT (usuario_id) DO UPDATE
      SET access_token  = EXCLUDED.access_token,
          refresh_token = COALESCE(EXCLUDED.refresh_token, google_tokens.refresh_token),
          token_expiry  = EXCLUDED.token_expiry,
          google_email  = EXCLUDED.google_email,
          updated_at    = now()
  `;
}

export async function deleteToken(userId: string) {
  await sql`DELETE FROM google_tokens WHERE usuario_id = ${userId}::uuid`;
}

// ── Get authenticated client for a user ───────────────────────────────────────

export async function getAuthClient(userId: string) {
  const stored = await getStoredToken(userId);
  if (!stored) return null;

  const auth = makeOAuth2Client();
  auth.setCredentials({
    access_token: String(stored.access_token),
    refresh_token: stored.refresh_token
      ? String(stored.refresh_token)
      : undefined,
    expiry_date: stored.token_expiry
      ? new Date(String(stored.token_expiry)).getTime()
      : undefined,
  });

  // Auto-refresh: save new tokens if refreshed
  auth.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await saveToken(
        userId,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expiry_date,
        null
      );
    }
  });

  return auth;
}

// ── Fetch Google Calendar events ───────────────────────────────────────────────

export async function fetchGoogleEvents(
  userId: string,
  startStr: string,
  endStr: string
): Promise<GoogleCalendarEvent[]> {
  const auth = await getAuthClient(userId);
  if (!auth) return [];

  try {
    const calendarApi = google.calendar({ version: "v3", auth });
    const res = await calendarApi.events.list({
      calendarId: "primary",
      timeMin: new Date(startStr).toISOString(),
      timeMax: new Date(endStr).toISOString(),
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 250,
    });

    return (res.data.items ?? []).map((item) => ({
      id: `gcal-${item.id}`,
      title: item.summary ?? "(sem título)",
      start: item.start?.dateTime ?? item.start?.date ?? "",
      end: item.end?.dateTime ?? item.end?.date ?? undefined,
      allDay: !item.start?.dateTime,
      htmlLink: item.htmlLink ?? null,
      description: item.description ?? null,
    }));
  } catch {
    return [];
  }
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay: boolean;
  htmlLink: string | null;
  description: string | null;
}

// ── Config check ───────────────────────────────────────────────────────────────

export function googleConfigured() {
  return !!(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI
  );
}
