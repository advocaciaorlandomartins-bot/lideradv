import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session, "gerenciador", "ver"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await sql`SELECT NOW() as time, version() as version`;
    return NextResponse.json({ connected: true, ...result[0] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ connected: false, error: msg }, { status: 503 });
  }
}
