import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  getMensagensConfig,
  saveMensagensConfig,
} from "@/lib/mensagens-config-db";
import type { MensagensConfig } from "@/config/mensagens";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.categoria !== "Administrador(a)")
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 }
    );

  const config = await getMensagensConfig();
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.categoria !== "Administrador(a)")
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 }
    );

  const updates: Partial<MensagensConfig> = await req.json();
  await saveMensagensConfig(updates);
  return NextResponse.json({ ok: true });
}
