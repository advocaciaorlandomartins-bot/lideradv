import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { enviarMensagemDireta } from "@/lib/prevbot-outbound";

export const dynamic = "force-dynamic";

// Endpoint para testar envio de mensagem WhatsApp (apenas admins)
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.categoria !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores." },
      { status: 403 }
    );
  }

  const { telefone, mensagem } = await req.json().catch(() => ({}));
  if (!telefone || !mensagem) {
    return NextResponse.json(
      { error: "telefone e mensagem são obrigatórios." },
      { status: 400 }
    );
  }

  const resultado = await enviarMensagemDireta({ telefone, mensagem });
  return NextResponse.json(resultado);
}
