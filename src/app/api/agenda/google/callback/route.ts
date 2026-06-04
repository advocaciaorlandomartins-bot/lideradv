import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { makeOAuth2Client, saveToken } from "@/lib/google-calendar";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state"); // user ID
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/dashboard/agenda?google_error=${encodeURIComponent(error)}`,
        req.url
      )
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/dashboard/agenda?google_error=missing_code", req.url)
    );
  }

  // Verify the session user matches the state
  const session = await getSession();
  if (!session || session.id !== state) {
    return NextResponse.redirect(
      new URL("/dashboard/agenda?google_error=invalid_state", req.url)
    );
  }

  try {
    const auth = makeOAuth2Client();
    const { tokens } = await auth.getToken(code);

    // Get user email from Google
    auth.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email ?? null;

    await saveToken(
      session.id,
      tokens.access_token!,
      tokens.refresh_token,
      tokens.expiry_date,
      email
    );

    return NextResponse.redirect(
      new URL("/dashboard/agenda?google_connected=1", req.url)
    );
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/dashboard/agenda?google_error=token_exchange", req.url)
    );
  }
}
