import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import sql from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/admin/lembretes-pendentes?dias=7
 * Lista lembretes agendados não enviados nos próximos N dias.
 * Requer sessão de admin ou qualquer usuário logado.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (session.categoria !== "Administrador(a)")
    return NextResponse.json(
      { error: "Acesso restrito a administradores." },
      { status: 403 }
    );

  const url = new URL(req.url);
  const dias = Math.min(parseInt(url.searchParams.get("dias") ?? "7"), 30);

  const rows = await sql`
    SELECT
      la.id::text,
      la.tipo,
      la.destinatario_tipo,
      la.destinatario_telefone,
      la.destinatario_nome,
      la.cliente_nome,
      la.mensagem,
      la.enviar_em,
      la.enviado,
      la.erro,
      la.referencia_tipo,
      la.referencia_id::text
    FROM lembretes_agendados la
    WHERE la.enviado = false
      AND la.enviar_em BETWEEN NOW() AND NOW() + (${dias} || ' days')::interval
    ORDER BY la.enviar_em ASC
    LIMIT 100
  `;

  return NextResponse.json({
    total: rows.length,
    lembretes: rows.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      destinatario: `${r.destinatario_nome} (${r.destinatario_tipo}) — ${r.destinatario_telefone}`,
      cliente: r.cliente_nome,
      enviarEm: r.enviar_em,
      referencia: `${r.referencia_tipo}/${r.referencia_id}`,
      mensagem: String(r.mensagem).substring(0, 100) + "…",
      erro: r.erro,
    })),
  });
}
