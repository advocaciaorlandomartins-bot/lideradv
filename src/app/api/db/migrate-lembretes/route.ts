import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || session.categoria !== "Administrador(a)") {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS lembretes_agendados (
        id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        tipo                 VARCHAR(60) NOT NULL,
        referencia_tipo      VARCHAR(30),
        referencia_id        UUID,
        cliente_id           UUID,
        cliente_nome         VARCHAR(200),
        destinatario_tipo    VARCHAR(20),
        destinatario_telefone VARCHAR(30),
        destinatario_nome    VARCHAR(200),
        mensagem             TEXT NOT NULL,
        enviar_em            TIMESTAMP WITH TIME ZONE NOT NULL,
        enviado              BOOLEAN DEFAULT FALSE,
        enviado_em           TIMESTAMP WITH TIME ZONE,
        tentativas           INTEGER DEFAULT 0,
        erro                 TEXT,
        created_at           TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS idx_lembretes_pendentes
        ON lembretes_agendados (enviar_em)
        WHERE NOT enviado
    `;

    return NextResponse.json({
      ok: true,
      message: "Tabela lembretes_agendados criada.",
    });
  } catch (err) {
    console.error("[migrate-lembretes]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
