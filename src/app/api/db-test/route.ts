import { NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session, "gerenciador", "ver"))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await sql`SELECT NOW() as time`;
    return NextResponse.json({ connected: true, time: result[0].time });
  } catch (err) {
    console.error(
      "[db-test]",
      err instanceof Error ? err.message : String(err)
    );
    return NextResponse.json(
      { connected: false, error: "Falha na conexão com o banco de dados." },
      { status: 503 }
    );
  }
}
