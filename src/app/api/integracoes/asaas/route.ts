import { NextRequest, NextResponse } from "next/server";
import sql from "@/lib/db";
import { getSession } from "@/lib/session";

export interface AsaasConfig {
  ambiente: "prod" | "sandbox";
  juros: string;
  multa: string;
  gateway: boolean;
  temToken: boolean;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({}, { status: 401 });

  const rows = await sql`
    SELECT valor FROM integracoes_config WHERE chave = 'asaas' LIMIT 1
  `;

  if (!rows[0]) {
    return NextResponse.json({
      ambiente: "prod",
      juros: "",
      multa: "",
      gateway: true,
      temToken: false,
    } satisfies AsaasConfig);
  }

  const v = rows[0].valor as Record<string, unknown>;
  return NextResponse.json({
    ambiente: (v.ambiente as "prod" | "sandbox") ?? "prod",
    juros: (v.juros as string) ?? "",
    multa: (v.multa as string) ?? "",
    gateway: (v.gateway as boolean) ?? true,
    temToken: !!(v.token as string),
  } satisfies AsaasConfig);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({}, { status: 401 });
  if (session.categoria !== "Administrador(a)") {
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 }
    );
  }

  const body = await req.json();
  const { token, ambiente, juros, multa, gateway } = body as {
    token?: string;
    ambiente: string;
    juros: string;
    multa: string;
    gateway: boolean;
  };

  // If token empty, keep existing
  const existing = await sql`
    SELECT valor FROM integracoes_config WHERE chave = 'asaas' LIMIT 1
  `;
  const existingToken = existing[0]
    ? (existing[0].valor as Record<string, unknown>).token
    : null;

  const novoValor = {
    token: token?.trim() ? token.trim() : existingToken,
    ambiente,
    juros,
    multa,
    gateway,
  };

  await sql`
    INSERT INTO integracoes_config (chave, valor, updated_at)
    VALUES ('asaas', ${novoValor}, now())
    ON CONFLICT (chave) DO UPDATE
      SET valor = ${novoValor}, updated_at = now()
  `;

  return NextResponse.json({ ok: true });
}
