import "server-only";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session?.id)
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const [lembretes, crm] = await Promise.all([
      sql`
        SELECT
          COUNT(*) FILTER (WHERE NOT enviado AND enviar_em <= NOW() AND tentativas < 3)::int AS pendentes,
          COUNT(*) FILTER (WHERE NOT enviado AND tentativas >= 3)::int AS bloqueados,
          COUNT(*) FILTER (WHERE NOT enviado AND enviar_em > NOW())::int AS agendados,
          json_agg(
            json_build_object(
              'tipo', tipo,
              'nome', destinatario_nome,
              'telefone', destinatario_telefone,
              'enviar_em', to_char(enviar_em AT TIME ZONE 'America/Maceio', 'DD/MM/YYYY HH24:MI'),
              'tentativas', tentativas,
              'erro', erro
            ) ORDER BY enviar_em
          ) FILTER (WHERE NOT enviado AND enviar_em <= NOW() AND tentativas < 3) AS lista_pendentes
        FROM lembretes_agendados
      `.catch(() => [
        { pendentes: 0, bloqueados: 0, agendados: 0, lista_pendentes: null },
      ]),
      sql`
        SELECT COUNT(*)::int AS pendentes
        FROM prevbot_webhook_log WHERE status = 'pendente'
      `.catch(() => [{ pendentes: 0 }]),
    ]);

    const l = lembretes[0] ?? {
      pendentes: 0,
      bloqueados: 0,
      agendados: 0,
      lista_pendentes: null,
    };
    const c = crm[0] ?? { pendentes: 0 };

    return NextResponse.json({
      lembretes: {
        pendentes: l.pendentes ?? 0,
        bloqueados: l.bloqueados ?? 0,
        agendados: l.agendados ?? 0,
        lista: (l.lista_pendentes as unknown[] | null) ?? [],
      },
      crm_pendentes: c.pendentes ?? 0,
    });
  } catch (err) {
    console.error("[sistema/status]", err);
    return NextResponse.json({
      lembretes: { pendentes: 0, bloqueados: 0, agendados: 0, lista: [] },
      crm_pendentes: 0,
    });
  }
}
