import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { hasPermission } from "@/lib/permissoes";
import {
  getMensagensConfig,
  saveMensagensConfig,
} from "@/lib/mensagens-config-db";
import type { MensagensConfig } from "@/config/mensagens";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || !hasPermission(session, "configuracoes", "ver"))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const config = await getMensagensConfig();
  return NextResponse.json(config);
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  // Alinhado com escritorio-actions.ts (mesma página de Configurações) —
  // antes essa rota exigia categoria === "Administrador(a)" fixo enquanto
  // os outros dados do escritório usavam a permissão granular
  // configuracoes:editar, então um usuário com essa permissão concedida
  // sem ser literalmente "Administrador(a)" editava o resto da página mas
  // levava 403 só nos templates de mensagem.
  if (!session || !hasPermission(session, "configuracoes", "editar"))
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 }
    );

  const updates: Partial<MensagensConfig> = await req.json();
  await saveMensagensConfig(updates);
  return NextResponse.json({ ok: true });
}
