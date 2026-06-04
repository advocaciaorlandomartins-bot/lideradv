import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { deleteToken } from "@/lib/google-calendar";

export async function POST() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  await deleteToken(session.id);
  return NextResponse.json({ ok: true });
}
