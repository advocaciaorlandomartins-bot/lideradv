import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  makeOAuth2Client,
  GOOGLE_SCOPES,
  googleConfigured,
} from "@/lib/google-calendar";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  if (!googleConfigured()) {
    return NextResponse.json(
      {
        error:
          "Google Calendar não configurado. Defina GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REDIRECT_URI no .env.local",
      },
      { status: 503 }
    );
  }

  const auth = makeOAuth2Client();
  const url = auth.generateAuthUrl({
    access_type: "offline",
    scope: GOOGLE_SCOPES,
    prompt: "consent",
    state: session.id, // pass user ID through state
  });

  return NextResponse.redirect(url);
}
