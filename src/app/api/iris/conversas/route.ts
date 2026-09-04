import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { listarConversas } from "@/lib/iris-conversas-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const conversas = await listarConversas(session.id);
  return NextResponse.json({ conversas });
}
