import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || !hasPermission(session, "clientes", "ver")) {
    return NextResponse.json([], { status: 401 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json([]);

  const rows = await sql`
    SELECT id::text, name
    FROM clients
    WHERE name ILIKE ${"%" + q + "%"}
    ORDER BY name
    LIMIT 10
  `;

  return NextResponse.json(
    rows.map((r) => ({ id: String(r.id), name: String(r.name) }))
  );
}
