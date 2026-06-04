import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getStoredToken, googleConfigured } from "@/lib/google-calendar";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ connected: false });

  const configured = googleConfigured();
  if (!configured)
    return NextResponse.json({ connected: false, configured: false });

  const token = await getStoredToken(session.id);
  return NextResponse.json({
    connected: !!token,
    configured: true,
    email: token?.google_email ?? null,
  });
}
