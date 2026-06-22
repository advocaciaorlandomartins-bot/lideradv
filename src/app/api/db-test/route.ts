import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await sql`SELECT NOW() as time, version() as version`;
  return NextResponse.json({ connected: true, ...result[0] });
}
